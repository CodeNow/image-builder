'use strict';

var async = require('async');
var childProcess = require('child_process');
var colors = require('colors');
var crypto = require('crypto');
var exists = require('101/exists');
var fs = require('fs');
var lockfile = require('lockfile');
var path = require('path');
var Transformer = require('fs-transform');

var Builder = require('./steps/build.js');
var injector = require('./steps/injector.js');
var utils = require('./utils');

var thisDir = __dirname;

// these are really for npm test so that we can re-direct the caches
var cacheDir = process.env.CACHE_DIR || '/cache';
var layerCacheDir = process.env.LAYER_CACHE_DIR || '/layer-cache';

var steps = module.exports = {
  data: {},
  dirs: {},
  dockerfileName: 'Dockerfile',
  logs: {},

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
      childProcess.execFile('mktemp', ['-d', template],
        function (err, stdout) {
          if (err) { return cb(err); }
          cb(null, stdout.toString().trim());
        });
    }
    function mkFile (template, cb) {
      childProcess.execFile('mktemp', [template],
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
          'downloadS3Files.js',
          '--bucket', process.env.RUNNABLE_KEYS_BUCKET,
          '--file', key,
          '--dest', steps.dirs.keyDirectory
        ];
        childProcess.execFile('node', args,
          {
            cwd: thisDir,
            maxBuffer: 1024 * 5000
          },
          steps.saveToLogs(cb)
        );
      },
      cb);
  },

  chmodAllKeys: function (cb) {
    if (!process.env.RUNNABLE_DEPLOYKEY ||
        process.env.RUNNABLE_DEPLOYKEY.length === 0) { return cb(); }

    // Can't use execFile here because we need to use bash's * construct
    childProcess.exec('chmod -R 600 *',
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
    // one call to downloadS3Files with this object
    var args = [
      'downloadS3Files.js', // this should be first
      '--bucket', process.env.RUNNABLE_FILES_BUCKET,
      '--files', process.env.RUNNABLE_FILES,
      '--prefix', process.env.RUNNABLE_PREFIX,
      '--dest', steps.dirs.dockerContext
    ];
    childProcess.execFile(
      'node',
      args,
      {
        cwd: thisDir,
        maxBuffer: 1024 * 5000
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
    // make sure we have a cache directory
    childProcess.execFile('mkdir', ['-p', cacheDir], function (err) {
      if (err) { return cb(err); }
      var reposAndBranches = zip(
        process.env.RUNNABLE_REPO.split(';'),
        process.env.RUNNABLE_COMMITISH.split(';'));
      var reposAndKeys = zip(
        process.env.RUNNABLE_REPO.split(';'),
        process.env.RUNNABLE_DEPLOYKEY.split(';'));
      var reposAndPRs = zip(
        process.env.RUNNABLE_REPO.split(';'),
        (process.env.RUNNABLE_PRS || '').split(';'));
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
          var prNumber = reposAndPRs[repo];
          var lockfileName = path.join(cacheDir, repoFullName + '.lock');
          var aquiredLock = false;
          utils.log(
            colors.yellow.bold('Cloning ' + repoFullName +
            ' into ' + repoName));
          async.waterfall([
            function makeRepoDir (cb) {
              childProcess.execFile('mkdir', ['-p', repoFullName],
                steps.saveToLogs(function (err) {
                  cb(err);
                })
              );
            },
            function addKeyToAgent (cb) {
              childProcess.execFile('ssh-add', ['-D'], function (err) {
                if (err) { return cb(err); }
                childProcess.execFile('ssh-add', [repoKeyPath],
                  steps.saveToLogs(function (err) {
                    cb(err);
                  })
                );
              });
            },
            function tryForLock (cb) {
              // need to make sure the directory for the username is there...
              childProcess.execFile('mkdir', ['-p', path.dirname(lockfileName)],
                function (err) {
                  if (err) { return cb(err); }
                  // TODO no steps and retries yet
                  lockfile.lock(lockfileName, function (err) {
                    // if no err, then we got the lock
                    aquiredLock = !err;
                    cb(null, aquiredLock);
                  });
                }
              );
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
                      childProcess.execFile('git', [
                          'clone',
                          '-q',
                          repo,
                          repoCacheDir
                        ],
                        { maxBuffer: 1024 * 5000 },
                        steps.saveToLogs(cb));
                    }
                  },
                  function getHEADCommit (cb) {
                    childProcess.execFile('git', ['rev-parse', 'HEAD'],
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
                    if (prNumber || fetchAndCheckout) {
                      var fetchOpts = ['fetch', '--all'];
                      if (prNumber) {
                        var head =  'pull/' + prNumber + '/head';
                        var newBranchName = 'pull-' + prNumber + '-head';
                        var fetchData = head + ':' + newBranchName;
                        fetchOpts = ['fetch', 'origin', fetchData];
                      }
                      childProcess.execFile('git', fetchOpts,
                        {
                          cwd: repoCacheDir,
                          maxBuffer: 1024 * 5000
                        },
                        steps.saveToLogs(cb)
                      );
                    } else {
                      cb();
                    }
                  },
                  function checkoutCommitish (cb) {
                    if (fetchAndCheckout) {
                      childProcess.execFile('git', [
                          'checkout',
                          '-q',
                          commitish
                        ],
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
                    ];
                    childProcess.execFile('cp', args, steps.saveToLogs(cb));
                  },
                  // TODO touch all the things (fix times after copy)
                  // function touchAllTheThings (cb) {}
                ], function (err) {
                  // trim out all the other stuff in arguments
                  cb(err);
                });
              } else {
                childProcess.execFile('git', [
                    'clone',
                    '-q',
                    repo,
                    repoTargetDir
                  ],
                  { maxBuffer: 1024 * 5000 },
                  steps.saveToLogs(function (err) {
                    if (err) { return cb(err); }
                    childProcess.execFile('git', ['checkout', '-q', commitish],
                      {
                        cwd: repoTargetDir,
                        maxBuffer: 1024 * 5000
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

  applySearchAndReplace: function (cb) {
    // Just-in-case check
    if (!process.env.SEARCH_AND_REPLACE_RULES) {
      utils.log('Skipping search and replace.');
      return cb();
    }

    utils.log('Applying search and replace rules.');

    var reposAndRules = zip(
      process.env.RUNNABLE_REPO.split(';'),
      process.env.SEARCH_AND_REPLACE_RULES.split(';'));

    async.mapSeries(Object.keys(reposAndRules), function (repo, transformCb) {
      var repoName = repo.split('/').pop();
      var repoTargetDir = path.join(steps.dirs.dockerContext, repoName);
      var rules = JSON.parse(reposAndRules[repo]);
      Transformer.transform(repoTargetDir, rules, transformCb);
    }, cb);
  },

  parseDockerfile: function (cb) {
    steps.dirs.buildRoot = steps.dirs.dockerContext;
    var dockerfilePath = path.join(steps.dirs.buildRoot, 'Dockerfile');
    var runnableBuildDockerfile = process.env.RUNNABLE_BUILD_DOCKERFILE;

    if (runnableBuildDockerfile) {
      // there is only one repo if we are in this mode
      var repoName = process.env.RUNNABLE_REPO.split('/')[1];
      var dockerfileFolderPath = path.dirname(runnableBuildDockerfile);
      steps.dockerfileName = path.basename(runnableBuildDockerfile);
      var repoRoot = steps.dirs.repoRoot = path.join(
        steps.dirs.dockerContext,
        repoName
      );
      steps.dirs.buildRoot = path.join(
        repoRoot,
        dockerfileFolderPath
      );
      steps.runnableBuildDockerfile = runnableBuildDockerfile;
      dockerfilePath = path.join(
        steps.dirs.buildRoot,
        steps.dockerfileName);
      utils.log('Loading Dockerfile: ' + dockerfilePath);
      utils.log('Build Root: ' + steps.dirs.buildRoot);
      utils.log('Repo Root: ' + steps.dirs.repoRoot);
      utils.log('Dockefile path: ' + steps.runnableBuildDockerfile);
    }
    var dockerfile = fs.readFileSync(dockerfilePath).toString();

    async.series([
      handleRunnableCache,
      handleDockerfileInjection,
      saveDockerfile
    ], cb);

    function handleRunnableCache (cb) {
      var runCmdRegex;
      /* jshint ignore:start */
      // sorry it's so looooong
      runCmdRegex =
        /^([R|r][U|u][N|n](.|\\\s)+\# ?[R|r][U|u][N|n][N|n][A|a][B|b][L|l][E|e]-[C|c][A|a][C|c][H|h][E|e])$/m;
      /* jshint ignore:end */
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

      childProcess.execFile('cp',  ['-p', layerTar, steps.dirs.dockerContext],
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
      dockerfile = injector(dockerfile, cb);
    }

    function saveDockerfile (cb) {
      fs.writeFileSync(dockerfilePath, dockerfile);
      cb();
    }
  },

  runDockerBuild: function (cb) {
    utils.log('Building server...'.bold.yellow);
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
      '--host', process.env.RUNNABLE_DOCKER,
      'history',
      '--no-trunc',
      imageId
    ];
    childProcess.execFile('docker', historyArgs,
      { maxBuffer: 1024 * 5000 },
      steps.saveToLogs(function (err, stdout) {
        if (err) { return cb(err); }
        var lines = stdout.toString().split('\n');
        var layer;
        for (var i = 0; i < lines.length; ++i) {
          /* jshint ignore:start */
          if (/\# ?[R|r][U|u][N|n][N|n][A|a][B|b][L|l][E|e]-[C|c][A|a][C|c][H|h][E|e]/
              .test(lines[i].trim())) {
            layer = lines[i].trim().split(' ').shift();
            break;
          }
          /* jshint ignore:end */
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
      '--host', process.env.RUNNABLE_DOCKER,
      'run',
      '-d',
      '--label', 'type=layerCopy',
      '-e', 'IMAGE_ID=' + steps.data.getLayerFromThisImage,
      '-e', 'CACHED_LAYER=' + steps.data.cacheThisLayer,
      '-e', 'CACHED_LAYER_HASH=' + steps.data.createdByHash,
      '-e', 'RUNNABLE_DOCKER=' + process.env.RUNNABLE_DOCKER,
      '-e', 'RUNNABLE_DOCKERTAG=' + process.env.RUNNABLE_DOCKERTAG,
      '-v', process.env.DOCKER_IMAGE_BUILDER_LAYER_CACHE +
        ':' + layerCacheDir
    ];
    if (/docker.sock/.test(process.env.RUNNABLE_DOCKER)) {
      args.push('-v');
      args.push('/var/run/docker.sock:/var/run/docker.sock');
    }
    args.push(process.env.RUNNABLE_IMAGE_BUILDER_NAME + ':' +
      process.env.RUNNABLE_IMAGE_BUILDER_TAG);
    args.push('./lib/dockerLayerArchive.sh');
    childProcess.execFile('docker', args, steps.saveToLogs(cb));
  },

  pushImage: function (cb) {
    if (!process.env.RUNNABLE_PUSH_IMAGE) {
      return cb();
    }
    var args = [
      '--host', process.env.RUNNABLE_DOCKER,
      'run',
      '-d',
      '--label="type=imagePush"',
      // retry if failed up to 5 times
      '--restart=on-failure:5',
      '-e', 'RUNNABLE_DOCKER=' + process.env.RUNNABLE_DOCKER,
      '-e', 'RUNNABLE_DOCKERTAG=' + process.env.RUNNABLE_DOCKERTAG,
      '-e', 'NODE_ENV=' + process.env.NODE_ENV
    ];
    if (/docker.sock/.test(process.env.RUNNABLE_DOCKER)) {
      args.push('-v');
      args.push('/var/run/docker.sock:/var/run/docker.sock');
    }
    args.push(process.env.RUNNABLE_IMAGE_BUILDER_NAME + ':' +
      process.env.RUNNABLE_IMAGE_BUILDER_TAG);
    args.push('node', './lib/push-image.js');
    childProcess.execFile('docker', args, steps.saveToLogs(cb));
  },

  saveToLogs: function (cb) {
    return function (err, stdout, stderr) {
      if (!exists(stdout)) { stdout = ''; }
      stdout = stdout.toString();
      if (!exists(stderr)) { stderr = ''; }
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
        }
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
