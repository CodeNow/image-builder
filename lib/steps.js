'use strict';

var colors = require('colors');
var childProcess = require('child_process');
var async = require('async');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var injector = require('./steps/injector');
var Builder = require('./steps/build');

var thisDir = __dirname;

// these are really for npm test so that we can re-direct the caches
var cacheDir = process.env.CACHE_DIR || '/cache';
var layerCacheDir = process.env.LAYER_CACHE_DIR || '/layer-cache';

var steps = module.exports = {
  dirs: {},
  logs: {},
  data: {},

  checkForRequiredEnvVars: function (cb) {
    var err;
    [
      'RUNNABLE_AWS_ACCESS_KEY',
      'RUNNABLE_AWS_SECRET_KEY'
    ].forEach(function (reqEnv) {
      if (!process.env[reqEnv] && !err) {
        err = new Error('Missing credentials.'.bold.red);
      }
    });
    cb(err);
  },

  makeWorkingFolders: function (cb) {
    async.parallel({
      dockerContext: mkDir.bind(null, '/tmp/rnnbl.XXXXXXXXXXXXXXXXXXXX'),
      keyDirectory: mkDir.bind(null, '/tmp/rnnbl.key.XXXXXXXXXXXXXXXXXXXX'),
      dockerBuild: mkFile.bind(null, '/tmp/rnnbl.log.XXXXXXXXXXXXXXXXXXXX'),
      stdout: mkFile.bind(null, '/tmp/rnnbl.ib.stdout.XXXXXXXXXXXXXXXXXXXX'),
      stderr: mkFile.bind(null, '/tmp/rnnbl.ib.stderr.XXXXXXXXXXXXXXXXXXXX')
    }, function (err, results) {
      if (err) { return cb(err); }
      steps.dirs.dockerContext = results.dockerContext;
      steps.dirs.keyDirectory = results.keyDirectory;
      steps.logs.dockerBuild = results.dockerBuild;
      steps.logs.stdout = results.stdout;
      steps.logs.stderr = results.stderr;
      cb();
    });

    function mkDir (template, cb) {
      childProcess.exec(
        'mktemp -d ' + template,
        function (err, stdout) {
          if (err) { return cb(err); }
          cb(null, stdout.toString().trim());
        });
    }
    function mkFile (template, cb) {
      childProcess.exec(
        'mktemp ' + template,
        function (err, stdout) {
          if (err) { return cb(err); }
          cb(null, stdout.toString().trim());
        });
    }
  },

  downloadBuildFiles: function (cb) {
    if (!process.env.RUNNABLE_FILES) { return cb(); }
    if (!process.env.RUNNABLE_FILES_BUCKET) {
      return cb(new Error('RUNNABLE_FILES_BUCKET is missing.'));
    }
    if (!process.env.RUNNABLE_PREFIX) {
      // since we use this, let's sanity set it
      process.env.RUNNABLE_PREFIX = '';
    }
    var files;
    try {
      files = JSON.parse(process.env.RUNNABLE_FILES);
    } catch (err) {
      return cb(new Error('RUNNABLE_FILES is poorly formatted JSON.'));
    }
    // one call to downloadS3Files with this object
    var args = [
      '--bucket ' + process.env.RUNNABLE_FILES_BUCKET,
      '--files "' + process.env.RUNNABLE_FILES.replace(/"/g, '\\"') + '"',
      '--prefix "' + process.env.RUNNABLE_PREFIX + '"',
      '--dest ' + steps.dirs.dockerContext
    ].join(' ');
    childProcess.exec('node downloadS3Files.js ' + args,
      {
        cwd: thisDir
      },
      steps.saveToLogs(cb)
    );
  },

  getRepositories: function (cb) {
    if (!process.env.RUNNABLE_REPO) {
      return cb();
    } else if (!process.env.RUNNABLE_COMMITISH) {
      return cb(new Error('RUNNABLE_COMMITISH is missing.'));
    }
    var reposAndBranches = zip(
      process.env.RUNNABLE_REPO.split(';'),
      process.env.RUNNABLE_COMMITISH.split(';'));

    async.mapSeries(
      Object.keys(reposAndBranches),
      function (repo, cb) {
        var repoName = repo.split('/').pop();
        var repoFullName = repo.split(':').pop();
        var repoTargetDir = path.join(steps.dirs.dockerContext, repoName);
        var commitish = reposAndBranches[repo];
        console.log(
          colors.yellow.bold('Cloning %s into ./%s'), repoFullName, repoName);
        async.waterfall([
          function makeRepoDir (cb) {
            childProcess.exec(
              'mkdir -p ' + repoFullName,
              steps.saveToLogs(function (err) {
                cb(err);
              })
            );
          },
          function clone (cb) {
            childProcess.exec(
              'git clone --depth=50 -q ' + repo + ' ' + repoTargetDir,
              steps.saveToLogs(function (err) {
                if (err) { return cb(err); }
                childProcess.exec('git checkout -qf ' + commitish,
                  {
                    cwd: repoTargetDir
                  },
                  steps.saveToLogs(function (err) { cb(err); }));
              })
            );
          },
          function removeRemote (cb) {
            childProcess.exec(
              'git remote rm origin',
              {
                cwd: repoTargetDir
              },
              steps.saveToLogs(function (err) { cb(err); })
            );
          }
        ], cb);
      },
      cb
    );
  },

  parseDockerfile: function (cb) {
    var dockerfile =
      fs.readFileSync(path.join(steps.dirs.dockerContext, 'Dockerfile'))
      .toString();

    async.series([
      handleRunnableCache,
      handleDockerfileInjection,
      saveDockerfile
    ], cb);

    function handleRunnableCache (cb) {
      /* jshint -W101 */
      // sorry it's so looooong
      var runCmdRegex =
        /^([R|r][U|u][N|n](.|\\\s)+\# ?[R|r][U|u][N|n][N|n][A|a][B|b][L|l][E|e]-[C|c][A|a][C|c][H|h][E|e])$/m;
      /* jshint +W101 */
      var match = runCmdRegex.exec(dockerfile);
      if (!match) {
        return cb();
      }
      steps.data.cachedLine = match[1];
      var md5sum = crypto.createHash('md5');
      md5sum.update(steps.data.cachedLine);
      steps.data.createdByHash = md5sum.digest('hex');

      // if the cache layer hash exists, use the layer.tar that should be there
      var layerTar = path.join(
        layerCacheDir,
        process.env.RUNNABLE_DOCKERTAG.split(':')[0],
        steps.data.createdByHash + '.tar');

      childProcess.exec('cp -p ' + layerTar + ' ' + steps.dirs.dockerContext,
        steps.saveToLogs(function (err) {
          // if this error'd, just don't use the layer
          if (err) { return cb(); }

          dockerfile = dockerfile.replace(
            match[1],
            'ADD ' + steps.data.createdByHash + '.tar /\n' + match[1]);

          steps.data.usingCache = true;
          cb();
        })
      );
    }

    function handleDockerfileInjection (cb) {
      dockerfile = injector(dockerfile);
      cb();
    }

    function saveDockerfile (cb) {
      fs.writeFileSync(
        path.join(steps.dirs.dockerContext, 'Dockerfile'),
        dockerfile);
      cb();
    }
  },

  runDockerBuild: function (cb) {
    console.log('Building server...'.bold.yellow);
    var builder = new Builder(steps);
    builder.runDockerBuild(cb);
  },

  parseBuildLogAndHistory: function (cb) {
    if (steps.data.usingCache) { return cb(); }
    var buildLog = fs.readFileSync(steps.logs.dockerBuild).toString();
    var lines = buildLog.split('\n');
    var match = null;
    for (var i = lines.length-1; i >= 0; --i) {
      match = /Successfully built ([0-9a-f]+)/.exec(lines[i]);
      if (match) { break; }
    }
    if (!match) {
      return cb(new Error('could not determine image built'));
    }
    var imageId = match[1];
    var historyArgs = [
      '--host ' + process.env.RUNNABLE_DOCKER,
      'history',
      '--no-trunc',
      imageId
    ].join(' ');
    childProcess.exec(
      'docker ' + historyArgs,
      steps.saveToLogs(function (err, stdout) {
        if (err) { return cb(err); }
        var lines = stdout.toString().split('\n');
        var layer;
        for (var i = 0; i < lines.length; ++i) {
          /* jshint -W101 */
          if (/\# ?[R|r][U|u][N|n][N|n][A|a][B|b][L|l][E|e]-[C|c][A|a][C|c][H|h][E|e]/
              .test(lines[i].trim())) {
            layer = lines[i].trim().split(' ').shift();
            break;
          }
          /* jshint +W101 */
        }
        if (layer) {
          steps.data.getLayerFromThisImage = imageId;
          steps.data.cacheThisLayer = layer;
        }
        cb();
      })
    );
  },

  copyLayer: function (cb) {
    if (steps.data.usingCache &&
        !steps.data.cacheThisLayer ||
        !steps.data.getLayerFromThisImage) { return cb(); }
    var args = [
      '--host ' + process.env.RUNNABLE_DOCKER,
      'run',
      '-d',
      '-e "IMAGE_ID=' + steps.data.getLayerFromThisImage + '"',
      '-e "CACHED_LAYER=' + steps.data.cacheThisLayer + '"',
      '-e "CACHED_LAYER_HASH=' + steps.data.createdByHash + '"',
      '-e "RUNNABLE_DOCKER=' + process.env.RUNNABLE_DOCKER + '"',
      '-e "RUNNABLE_DOCKERTAG=' + process.env.RUNNABLE_DOCKERTAG + '"',
      '-v "' + process.env.DOCKER_IMAGE_BUILDER_LAYER_CACHE + ':' +
        layerCacheDir + '"',
      '-v /var/run/docker.sock:/var/run/docker.sock',
      process.env.RUNNABLE_IMAGE_BUILDER_NAME + ':' +
        process.env.RUNNABLE_IMAGE_BUILDER_TAG,
      './lib/dockerLayerArchive.sh'
    ].join(' ');
    childProcess.exec('docker ' + args, steps.saveToLogs(cb));
  },

  saveToLogs: function (cb) {
    return function (err, stdout, stderr) {
      stdout = stdout.toString();
      stderr = stderr.toString();
      async.parallel([
        function saveStdout (cb) {
          if (stdout.length) {
            fs.appendFile(steps.logs.stdout, stdout, cb);
          } else {
            cb();
          }
        },
        function saveStderr (cb) {
          if (stderr.length) {
            fs.appendFile(steps.logs.stderr, stderr, cb);
          } else {
            cb();
          }
        },
      ], function (asyncErr) {
        if (asyncErr) {
          cb(new Error('error saving output to files'));
        } else if (err) {
          cb(err, stdout, stderr);
        } else {
          cb(null, stdout, stderr);
        }
      });
    };
  }

};

function zip (a, b) {
  return a.reduce(function (memo, curr, index) {
    memo[curr] = b[index];
    return memo;
  }, {});
}
