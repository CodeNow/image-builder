'use strict';

var colors = require('colors');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var async = require('async');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var lockfile = require('lockfile');
var concat = require('concat-stream');
var createCount = require('callback-count');

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
      exec(
        'mktemp -d ' + template,
        function (err, stdout) {
          if (err) { return cb(err); }
          cb(null, stdout.toString().trim());
        });
    }
    function mkFile (template, cb) {
      exec(
        'mktemp ' + template,
        function (err, stdout) {
          if (err) { return cb(err); }
          cb(null, stdout.toString().trim());
        });
    }
  },

  downloadDeployKeys: function (cb) {
    if (!process.env.RUNNABLE_DEPLOYKEY) { return cb(); }
    if (!process.env.RUNNABLE_KEYS_BUCKET) {
      return cb(new Error('RUNNABLE_KEYS_BUCKET is missing.'));
    }
    var deployKeys = process.env.RUNNABLE_DEPLOYKEY.split(';');
    async.map(deployKeys,
      function (key, cb) {
        var args = [
          '--bucket ' + process.env.RUNNABLE_KEYS_BUCKET,
          '--file ' + key,
          '--dest ' + steps.dirs.keyDirectory
        ].join(' ');
        exec('node downloadS3Files.js ' + args,
          {
            cwd: thisDir
          },
          steps.saveToLogs(cb)
        );
      },
      cb);
  },

  chmodAllKeys: function (cb) {
    if (!process.env.RUNNABLE_DEPLOYKEY ||
        process.env.RUNNABLE_DEPLOYKEY.length === 0) { return cb(); }

    exec('chmod -R 600 *',
      {
        cwd: steps.dirs.keyDirectory
      },
      steps.saveToLogs(cb)
    );
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
    console.log('Downloading build files...'.bold.yellow);
    // one call to downloadS3Files with this object
    var args = [
      '--bucket ' + process.env.RUNNABLE_FILES_BUCKET,
      '--files "' + process.env.RUNNABLE_FILES.replace(/"/g, '\\"') + '"',
      '--prefix "' + process.env.RUNNABLE_PREFIX + '"',
      '--dest ' + steps.dirs.dockerContext
    ].join(' ');
    exec('node downloadS3Files.js ' + args,
      {
        cwd: thisDir
      },
      steps.saveToLogs(cb)
    );
  },

  getRepositories: function (cb) {
    if (!process.env.RUNNABLE_REPO || process.env.RUNNABLE_REPO.length === 0) {
      return cb();
    } else if (process.env.RUNNABLE_REPO &&
              (!process.env.RUNNABLE_COMMITISH ||
               process.env.RUNNABLE_COMMITISH.length === 0)) {
      return cb(new Error('RUNNABLE_COMMITISH is missing.'));
    }
    // make sure we have a cache directory
    exec('mkdir -p ' + cacheDir, function (err) {
      if (err) { return cb(err); }
      var reposAndBranches = zip(
        process.env.RUNNABLE_REPO.split(';'),
        process.env.RUNNABLE_COMMITISH.split(';'));
      var reposAndKeys = zip(
        process.env.RUNNABLE_REPO.split(';'),
        process.env.RUNNABLE_DEPLOYKEY.split(';'));
      // TODO this could be in parallel
      async.mapSeries(
        Object.keys(reposAndBranches),
        function (repo, cb) {
          var repoName = repo.split('/').pop();
          var repoFullName = repo.split(':').pop();
          var repoCacheDir = path.join(cacheDir, repoFullName);
          var repoTargetDir = path.join(steps.dirs.dockerContext, repoName);
          var repoKey = reposAndKeys[repo];
          var repoKeyPath = path.join(steps.dirs.keyDirectory, repoKey);
          var commitish = reposAndBranches[repo];
          var lockfileName = path.join(cacheDir, repoFullName + '.lock');
          var aquiredLock = false;
          console.log(
            colors.yellow.bold('Cloning %s into ./%s'), repoFullName, repoName);
          async.waterfall([
            function makeRepoDir (cb) {
              exec('mkdir -p ' + repoFullName, steps.saveToLogs(function (err) {
                cb(err);
              }));
            },
            function addKeyToAgent (cb) {
              exec('ssh-add -D', function (err) {
                if (err) { return cb(err); }
                exec('ssh-add ' + repoKeyPath, steps.saveToLogs(function (err) {
                  cb(err);
                }));
              });
            },
            function tryForLock (cb) {
              // need to make sure the directory for the username is there...
              exec('mkdir -p ' + path.dirname(lockfileName), function (err) {
                if (err) { return cb(err); }
                // TODO no steps and retries yet
                lockfile.lock(lockfileName, function (err) {
                  // if no err, then we got the lock
                  aquiredLock = !err;
                  cb(null, aquiredLock);
                });
              });
            },
            function cacheOrClone (lockAquired, cb) {
              if (lockAquired) {
                var fetchAndCheckout = true;
                async.series([
                  function upsertCachedRepoDir (cb) {
                    if (fs.existsSync(path.join(repoCacheDir, '.git'))) {
                      // repo exists, just will update
                      cb();
                    } else {
                      exec(
                        'git clone -q ' + repo + ' ' + repoCacheDir,
                        steps.saveToLogs(cb));
                    }
                  },
                  function getHEADCommit (cb) {
                    exec('git rev-parse HEAD',
                      {
                        cwd: repoCacheDir
                      },
                      steps.saveToLogs(function (err, stdout) {
                        if (err) { return cb(err); }
                        fetchAndCheckout = (stdout.trim() !== commitish);
                        cb();
                      })
                    );
                  },
                  function updateCachedRepo (cb) {
                    if (fetchAndCheckout) {
                      exec('git fetch --all',
                        {
                          cwd: repoCacheDir
                        },
                        steps.saveToLogs(cb)
                      );
                    } else {
                      cb();
                    }
                  },
                  function checkoutCommitish (cb) {
                    if (fetchAndCheckout) {
                      exec('git checkout -q ' + commitish,
                        {
                          cwd: repoCacheDir
                        },
                        steps.saveToLogs(cb)
                      );
                    } else {
                      cb();
                    }
                  },
                  function copyToTargetDir (cb) {
                    // NOTE: a potential hole here. check how links are handled
                    var args = [
                      '-p',
                      '-r',
                      '-d',
                      repoCacheDir,
                      repoTargetDir
                    ].join(' ');
                    exec('cp ' + args, steps.saveToLogs(cb));
                  },
                  // TODO touch all the things (fix times after copy)
                  // function touchAllTheThings (cb) {}
                ], function (err) {
                  // trim out all the other stuff in arguments
                  cb(err);
                });
              } else {
                exec(
                  'git clone -q ' + repo + ' ' + repoTargetDir,
                  steps.saveToLogs(function (err) {
                    if (err) { return cb(err); }
                    exec('git checkout -q ' + commitish,
                      {
                        cwd: repoTargetDir
                      },
                      steps.saveToLogs(function (err) { cb(err); }));
                  }));
              }
            },
            function releaseLock (cb) {
              if (aquiredLock) {
                lockfile.unlock(lockfileName, function (err) {
                  if (!err) {
                    aquiredLock = null;
                  }
                  cb(err);
                });
              } else {
                cb();
              }
            }
          ], function (err) {
            if (aquiredLock) {
              lockfile.unlock(lockfileName, function () {});
            }
            cb(err);
          });
        },
        cb
      );
    });
  },

  parseDockerfile: function (cb) {
    var dockerfile = fs.readFileSync(
      path.join(steps.dirs.dockerContext, 'Dockerfile')).toString();
    /* jshint -W101 */
    // sorry it's so looooong
    var runCmdRegex =
      /^([R|r][U|u][N|n](.|\\\s)+\# ?[R|r][U|u][N|n][N|n][A|a][B|b][L|l][E|e]-[C|c][A|a][C|c][H|h][E|e])$/m;
    /* jshint +W101 */
    var match = runCmdRegex.exec(dockerfile);
    if (match) {
      steps.data.cachedLine = match[1];
      var md5sum = crypto.createHash('md5');
      md5sum.update(steps.data.cachedLine);
      steps.data.createdByHash = md5sum.digest('hex');

      // if the cache layer hash exists, use the layer.tar that should be there
      var filename = path.join(
        layerCacheDir,
        process.env.RUNNABLE_DOCKERTAG.split(':')[0],
        'hash.' + steps.data.createdByHash);
      var layerTar = path.join(
        layerCacheDir,
        process.env.RUNNABLE_DOCKERTAG.split(':')[0],
        'layer.tar');
      if (fs.existsSync(filename)) {
        dockerfile = dockerfile.replace(
          match[1],
          'ADD layer.tar /\n' + match[1]);
        fs.writeFileSync(
          path.join(steps.dirs.dockerContext, 'Dockerfile'),
          dockerfile);
        steps.data.usingCache = true;
        exec(
          'cp -p ' + layerTar + ' ' + steps.dirs.dockerContext,
          steps.saveToLogs(cb));
      } else { cb(); }
    } else { cb(); }
  },

  runDockerBuild: function (cb) {
    if (!process.env.RUNNABLE_DOCKER) { return cb(); }
    if (!process.env.RUNNABLE_DOCKERTAG) {
      return cb(new Error('RUNNABLE_DOCKERTAG is missing.'));
    }
    if (!process.env.RUNNABLE_DOCKER_BUILDOPTIONS) {
      process.env.RUNNABLE_DOCKER_BUILDOPTIONS = '';
    }
    console.log('Building server...'.bold.yellow);
    var args = [
      '--host=' + process.env.RUNNABLE_DOCKER,
      'build',
      '--tag=' + process.env.RUNNABLE_DOCKERTAG
    ];
    if (process.env.RUNNABLE_DOCKER_BUILDOPTIONS &&
        process.env.RUNNABLE_DOCKER_BUILDOPTIONS !== '') {
      args.push.apply(
        args, process.env.RUNNABLE_DOCKER_BUILDOPTIONS.split(' '));
    }
    args.push(
      steps.dirs.dockerContext
    );
    var count = createCount(3, cb);
    var build = spawn('docker', args);
    var stdoutHandler = concat(function (data) {
      fs.appendFileSync(steps.logs.dockerBuild, data);
      steps.saveToLogs(count.next)(null, data, '');
    });
    var stderrHandler = concat(function (data) {
      steps.saveToLogs(count.next)(null, '', data);
    });
    build.stdout.pipe(stdoutHandler);
    build.stdout.pipe(process.stdout);
    build.stderr.pipe(stderrHandler);
    build.stderr.pipe(process.stderr);
    build.on('error', count.next);
    build.on('close', function (code) {
      if (code !== 0) {
        count.next(
          new Error(
            'Docker build exited with non-zero exit code (' + code + ')'));
      } else {
        count.next();
      }
    });
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
    exec('docker ' + historyArgs, steps.saveToLogs(function (err, stdout) {
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
    }));
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
      '-e "RUNNABLE_DOCKER=' + process.env.RUNNABLE_DOCKER + '"',
      '-e "RUNNABLE_DOCKERTAG=' + process.env.RUNNABLE_DOCKERTAG + '"',
      '-v "' + process.env.DOCKER_IMAGE_BUILDER_LAYER_CACHE + ':' +
        layerCacheDir + '"',
      '-v /var/run/docker.sock:/var/run/docker.sock',
      process.env.RUNNABLE_IMAGE_BUILDER_NAME + ':' +
        process.env.RUNNABLE_IMAGE_BUILDER_TAG,
      './dockerLayerArchive.sh'
    ].join(' ');
    exec('docker ' + args, steps.saveToLogs(function (err) {
      if (err) { return cb(err); }
      var hashDirectory = path.join(
        layerCacheDir,
        process.env.RUNNABLE_DOCKERTAG.split(':')[0]);
      var allHashFiles = path.join(
        hashDirectory,
        'hash.*');
      var filenameToTouch = path.join(
        hashDirectory,
        'hash.' + steps.data.createdByHash);
      exec(
        'mkdir -p ' + hashDirectory + ' && ' +
        'rm -f ' + allHashFiles + ' && ' +
        'touch ' + filenameToTouch,
        steps.saveToLogs(cb));
    }));
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
