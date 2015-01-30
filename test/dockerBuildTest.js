'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var dockerMock = require('docker-mock');
dockerMock.listen(5555);

var cacheDir = process.env.CACHE_DIR;
if (!cacheDir) {
  cacheDir = process.env.CACHE_DIR = '/tmp/cache';
}
var layerCacheDir = process.env.LAYER_CACHE_DIR;
if (!layerCacheDir) {
  layerCacheDir = process.env.LAYER_CACHE_DIR = '/tmp/layer-cache';
}
exec('mkdir -p ', cacheDir);
exec('mkdir -p ', layerCacheDir);

// require this after we have now changed the env for the directories
var steps = require('../lib/steps');

lab.test('we need environment variables to run the tests', function (done) {
  var keys = [
    'AWS_ACCESS_KEY',
    'AWS_SECRET_KEY'
  ];
  keys.forEach(function (key) {
    expect(process.env[key]).to.not.be.undefined().and.not.equal('');
  });
  done();
});

var requiredEnvVars = {
  RUNNABLE_AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY,
  RUNNABLE_AWS_SECRET_KEY: process.env.AWS_SECRET_KEY
};
lab.beforeEach(function (done) {
  Object.keys(requiredEnvVars).forEach(function (key) {
    process.env[key] = requiredEnvVars[key];
  });
  done();
});

lab.experiment('checkForRequiredEnvVars', function () {
  lab.experiment('fails', function () {
    lab.beforeEach(function (done) {
      Object.keys(requiredEnvVars).forEach(
        function (key) { delete process.env[key]; });
      done();
    });
    lab.test('when required env vars are missing', function (done) {
      steps.checkForRequiredEnvVars(function (err) {
        expect(!!err).to.be.true();
        expect(err.message).to.match(/Missing credentials./);
        done(null);
      });
    });
  });
  lab.experiment('succeeds', function () {
    lab.test('when all env vars are present', function (done) {
      steps.checkForRequiredEnvVars(function (err) {
        if (err) { return done(err); }
        done(err);
      });
    });
  });
});

lab.experiment('makeWorkingFolders', function () {
  lab.experiment('succeeds', function () {
    var createdFolders = [
      'dockerContext',
      'keyDirectory'
    ];
    lab.test('to create all folders', function (done) {
      steps.makeWorkingFolders(function (err) {
        if (err) { return done(err); }
        createdFolders.forEach(function (dirName) {
          expect(steps.dirs[dirName]).to.not.be.undefined();
          expect(fs.existsSync(steps.dirs[dirName])).to.be.true();
        });
        done();
      });
    });
  });
});

lab.experiment('downloadDeployKeys', function () {
  var requiredEnvVars = {
    RUNNABLE_KEYS_BUCKET: 'runnable.image-builder',
    RUNNABLE_DEPLOYKEY: 'flaming-octo-nemesis.key'
  };
  lab.beforeEach(function (done) {
    Object.keys(requiredEnvVars).forEach(
      function (key) { process.env[key] = requiredEnvVars[key]; });
    done();
  });
  lab.beforeEach(steps.makeWorkingFolders.bind(steps));

  lab.experiment('fails', function () {
    lab.beforeEach(function (done) {
      delete process.env.RUNNABLE_KEYS_BUCKET;
      done();
    });
    lab.test('when the required env vars are missing', function (done) {
      steps.downloadDeployKeys(function (err) {
        expect(!!err).to.be.true();
        expect(err.message).to.match(/RUNNABLE_KEYS_BUCKET is missing/);
        done();
      });
    });
  });
  lab.experiment('succeeds', function () {
    lab.experiment('if there are no keys', function () {
      lab.beforeEach(function (done) {
        delete process.env.RUNNABLE_DEPLOYKEY;
        done();
      });
      lab.afterEach(function (done) {
        process.env.RUNNABLE_DEPLOYKEY = requiredEnvVars.RUNNABLE_DEPLOYKEY;
        done();
      });
      lab.test('it should be fine', function (done) {
        steps.downloadDeployKeys(function (err) {
          if (err) { return done(err); }
          // TODO check for empty directory
          done();
        });
      });
    });
    lab.experiment('with keys to download', function () {
      lab.test('to download the keys', { timeout: 5000 }, function (done) {
        steps.downloadDeployKeys(function (err) {
          if (err) { return done(err); }
          var keyPath = path.join(
            steps.dirs.keyDirectory,
            requiredEnvVars.RUNNABLE_DEPLOYKEY);
          expect(fs.existsSync(keyPath)).to.be.true();
          done();
        });
      });
    });
  });
});

lab.experiment('chmodAllKeys', function () {
  var requiredEnvVars = {
    RUNNABLE_KEYS_BUCKET: 'runnable.image-builder',
    RUNNABLE_DEPLOYKEY: 'flaming-octo-nemesis.key'
  };
  lab.beforeEach(function (done) {
    Object.keys(requiredEnvVars).forEach(
      function (key) { process.env[key] = requiredEnvVars[key]; });
    done();
  });
  lab.beforeEach(steps.makeWorkingFolders.bind(steps));

  lab.experiment('succeeds', function () {
    lab.experiment('when there are keys', function () {
      lab.beforeEach({ timeout: 5000 }, steps.downloadDeployKeys.bind(steps));

      lab.test('to set the permissions on the keys', function (done) {
        steps.chmodAllKeys(function (err) {
          if (err) { return done(err); }
          var keyPath = path.join(
            steps.dirs.keyDirectory,
            requiredEnvVars.RUNNABLE_DEPLOYKEY);
          fs.stat(keyPath, function (err, stats) {
            if (err) { return done(err); }
            expect(stats.mode).to.equal(33152);
            done();
          });
        });
      });
    });
  });
});

lab.experiment('downloadBuildFiles', function () {
  var requiredEnvVars = {
    RUNNABLE_FILES: '{ "Dockerfile": "K6cluDupwQdFRsuTPJ0SFUrxUB4lmF_Q" }',
    RUNNABLE_FILES_BUCKET: 'runnable.image-builder'
  };
  lab.beforeEach(function (done) {
    Object.keys(requiredEnvVars).forEach(
      function (key) { process.env[key] = requiredEnvVars[key]; });
    done();
  });
  lab.beforeEach(steps.makeWorkingFolders.bind(steps));

  lab.experiment('fails', function () {
    lab.beforeEach(function (done) {
      delete process.env.RUNNABLE_FILES_BUCKET;
      done();
    });
    lab.test('when the required env vars are missing', function (done) {
      steps.downloadBuildFiles(function (err) {
        expect(!!err).to.be.true();
        expect(err.message).to.match(/RUNNABLE_FILES_BUCKET is missing/);
        done();
      });
    });
  });
  lab.experiment('succeeds', function () {
    lab.experiment('if there are no files', function () {
      lab.beforeEach(function (done) {
        delete process.env.RUNNABLE_FILES;
        done();
      });
      lab.afterEach(function (done) {
        process.env.RUNNABLE_FILES = requiredEnvVars.RUNNABLE_FILES;
        done();
      });
      lab.test('it should be fine', function (done) {
        steps.downloadBuildFiles(function (err) {
          if (err) { return done(err); }
          // TODO check for empty directory
          done();
        });
      });
    });
    lab.experiment('with keys to download', function () {
      lab.test('to download the keys', function (done) {
        steps.downloadBuildFiles(function (err) {
          if (err) { return done(err); }
          var dockerfilePath = path.join(
            steps.dirs.dockerContext,
            'Dockerfile');
          expect(fs.existsSync(dockerfilePath)).to.be.true();
          done();
        });
      });
    });
  });
});

lab.experiment('getRepositories', function () {
  var requiredEnvVars = {
    RUNNABLE_REPO: 'git@github.com:bkendall/flaming-octo-nemesis',
    RUNNABLE_COMMITISH: 'master',
    RUNNABLE_KEYS_BUCKET: 'runnable.image-builder',
    RUNNABLE_DEPLOYKEY: 'flaming-octo-nemesis.key'
  };
  lab.beforeEach(function (done) {
    Object.keys(requiredEnvVars).forEach(
      function (key) { process.env[key] = requiredEnvVars[key]; });
    done();
  });
  lab.beforeEach(function (done) {
    exec('rm -rf ' + cacheDir + '/*', done);
  });
  lab.experiment('succeeds', function () {
    lab.beforeEach(steps.makeWorkingFolders.bind(steps));
    lab.beforeEach({ timeout: 5000 }, steps.downloadDeployKeys.bind(steps));
    lab.beforeEach(steps.chmodAllKeys.bind(steps));

    lab.experiment('when there is a repo', function () {
      /* github can be slow to respond. long timeout */
      lab.test('to download the repo', { timeout: 10000 }, function (done) {
        steps.getRepositories(function (err) {
          if (err) { return done(err); }
          var repoCacheDir = path.join(
            cacheDir,
            'bkendall/flaming-octo-nemesis');
          var repoTargetDir = path.join(
            steps.dirs.dockerContext,
            'flaming-octo-nemesis');
          expect(fs.existsSync(repoCacheDir)).to.be.true();
          expect(fs.existsSync(repoTargetDir)).to.be.true();
          done();
        });
      });
    });
    lab.experiment('when a lock already exists for the repo', function () {
      lab.beforeEach(function (done) {
        var cmds = [
          'mkdir',
          '-p',
          cacheDir + '/bkendall',
          '&& touch',
          cacheDir + '/bkendall/flaming-octo-nemesis.lock'
        ].join(' ');
        exec(cmds, done);
      });
      /* github can be slow to respond. long timeout */
      lab.test('to download the repo', { timeout: 10000 }, function (done) {
        steps.getRepositories(function (err) {
          if (err) { return done(err); }
          var repoCacheDir = path.join(
            cacheDir,
            'bkendall/flaming-octo-nemesis');
          var repoCacheDirLock = path.join(
            cacheDir,
            'bkendall/flaming-octo-nemesis.lock');
          var repoTargetDir = path.join(
            steps.dirs.dockerContext,
            'flaming-octo-nemesis');
          expect(fs.existsSync(repoCacheDir)).to.be.false();
          expect(fs.existsSync(repoCacheDirLock)).to.be.true();
          expect(fs.existsSync(repoTargetDir)).to.be.true();
          done();
        });
      });
    });
  });
});

lab.experiment('parseDockerfile', function () {
  var requiredEnvVars = {
    RUNNABLE_DOCKERTAG: 'test-docker-tag',
    RUNNABLE_FILES: '{ "Dockerfile": "AolcUvaTfKOFJg74ABqL9NN08333MS_t" }',
    RUNNABLE_FILES_BUCKET: 'runnable.image-builder'
  };
  lab.beforeEach(function (done) {
    Object.keys(requiredEnvVars).forEach(
      function (key) { process.env[key] = requiredEnvVars[key]; });
    done();
  });
  lab.experiment('succeeds', function () {
    lab.beforeEach(steps.makeWorkingFolders.bind(steps));

    lab.experiment('with runnable-cache', function () {
      lab.beforeEach({ timeout: 5000 }, steps.downloadBuildFiles.bind(steps));

      lab.test('should catch the cache line', function (done) {
        steps.parseDockerfile(function (err) {
          if (err) { return done(err); }
          expect(!!steps.data.usingCache).to.be.false();
          expect(steps.data.cachedLine).to.not.be.undefined();
          expect(steps.data.createdByHash).to.not.be.undefined();
          done();
        });
      });
    });
    lab.experiment('with funky Runnable-cache', function () {
      lab.beforeEach(function (done) {
        process.env.RUNNABLE_FILES =
          '{ "Dockerfile": "KKUneazEu5iFAJAkfOIHe0C2jaeGgZpn" }';
        done();
      });
      lab.beforeEach({ timeout: 5000 }, steps.downloadBuildFiles.bind(steps));

      lab.test('should find the cached line', function (done) {
        steps.parseDockerfile(function (err) {
          if (err) { return done(err); }
          expect(!!steps.data.usingCache).to.be.false();
          expect(steps.data.cachedLine).to.not.be.undefined();
          expect(steps.data.createdByHash).to.not.be.undefined();
          done();
        });
      });
    });
  });
});

lab.experiment('runDockerBuild', function () {
  var requiredEnvVars = {
    RUNNABLE_DOCKER: 'tcp://localhost:5555',
    RUNNABLE_DOCKERTAG: 'test-docker-tag',
    RUNNABLE_FILES: '{ "Dockerfile": "K6cluDupwQdFRsuTPJ0SFUrxUB4lmF_Q" }',
    RUNNABLE_FILES_BUCKET: 'runnable.image-builder'
  };
  lab.beforeEach(function (done) {
    Object.keys(requiredEnvVars).forEach(
      function (key) { process.env[key] = requiredEnvVars[key]; });
    done();
  });
  lab.experiment('fails', function () {
    lab.beforeEach(function (done) {
      delete process.env.RUNNABLE_DOCKERTAG;
      done();
    });
    lab.test('when the required env vars are missing', function (done) {
      steps.runDockerBuild(function (err) {
        expect(!!err).to.be.true();
        expect(err.message).to.match(/RUNNABLE_DOCKERTAG is missing/);
        done();
      });
    });
  });
  lab.experiment('succeeds', function () {
    lab.beforeEach(steps.makeWorkingFolders.bind(steps));
    lab.beforeEach({ timeout: 5000 }, steps.downloadBuildFiles.bind(steps));

    lab.experiment('if there is no dockerhost', function () {
      lab.beforeEach(function (done) {
        delete process.env.RUNNABLE_DOCKER;
        done();
      });
      lab.test('should do nothing', function (done) {
        steps.runDockerBuild(function (err) {
          if (err) { return done(err); }
          done();
        });
      });
    });
    lab.experiment('to call out to docker and run the build', function () {
      lab.test('should do nothing', function (done) {
        steps.runDockerBuild(function (err) {
          if (err) { return done(err); }
          var dockerArgs = [
            '--host ' + requiredEnvVars.RUNNABLE_DOCKER,
            'images'
          ].join(' ');
          exec('docker ' + dockerArgs, function (err, stdout) {
            if (err) { return done(err); }
            expect(stdout.trim().split('\n')).to.have.length(2);
            done(err);
          });
        });
      });
    });
  });
});

lab.experiment('parseBuildLogAndHistory', function () {
  var requiredEnvVars = {
    RUNNABLE_DOCKER: 'tcp://localhost:5555',
    RUNNABLE_DOCKERTAG: 'test-docker-tag',
    RUNNABLE_FILES: '{ "Dockerfile": "AolcUvaTfKOFJg74ABqL9NN08333MS_t" }',
    RUNNABLE_FILES_BUCKET: 'runnable.image-builder'
  };
  lab.beforeEach(function (done) {
    Object.keys(requiredEnvVars).forEach(
      function (key) { process.env[key] = requiredEnvVars[key]; });
    done();
  });
  lab.experiment('succeeds', function () {
    lab.beforeEach(steps.makeWorkingFolders.bind(steps));

    lab.experiment('with runnable-cache', function () {
      lab.beforeEach({ timeout: 5000 }, steps.downloadBuildFiles.bind(steps));
      lab.beforeEach(steps.runDockerBuild.bind(steps));
      lab.test('should catch the cached layer', function (done) {
        steps.parseBuildLogAndHistory(function (err) {
          if (err) { return done(err); }
          expect(steps.data.cacheThisLayer).to.be.match(/^[a-f0-9]+$/);
          done();
        });
      });
    });
    lab.experiment('with funky runnable-cache', function () {
      lab.beforeEach(function (done) {
        process.env.RUNNABLE_FILES =
          '{ "Dockerfile": "KKUneazEu5iFAJAkfOIHe0C2jaeGgZpn" }';
        done();
      });
      lab.beforeEach({ timeout: 5000 }, steps.downloadBuildFiles.bind(steps));
      lab.beforeEach(steps.runDockerBuild.bind(steps));
      lab.test('should catch the cached layer', function (done) {
        steps.parseBuildLogAndHistory(function (err) {
          if (err) { return done(err); }
          expect(steps.data.cacheThisLayer).to.be.match(/^[a-f0-9]+$/);
          done();
        });
      });
    });
  });
});
