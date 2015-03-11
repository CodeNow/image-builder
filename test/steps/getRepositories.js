'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

var childProcess = require('child_process');
var path = require('path');
var fs = require('fs');
var sinon = require('sinon');

var lockfile = require('lockfile');

var cacheDir = process.env.CACHE_DIR;
if (!cacheDir) {
  cacheDir = process.env.CACHE_DIR = '/tmp/cache';
}
var layerCacheDir = process.env.LAYER_CACHE_DIR;
if (!layerCacheDir) {
  layerCacheDir = process.env.LAYER_CACHE_DIR = '/tmp/layer-cache';
}

// require this after we have now changed the env for the directories
var steps = require('../../lib/steps');

var requiredEnvVars = {
  RUNNABLE_AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY,
  RUNNABLE_AWS_SECRET_KEY: process.env.AWS_SECRET_KEY
};
lab.before(function (done) {
  Object.keys(requiredEnvVars).forEach(function (key) {
    process.env[key] = requiredEnvVars[key];
  });
  done();
});

lab.experiment('getRepositories', function () {
  var requiredEnvVars = {
    RUNNABLE_REPO: 'git@github.com:bkendall/flaming-octo-nemesis',
    RUNNABLE_COMMITISH: '34a728c59e713b7fbf5b0d6ed3a8e4f4e2c695c5',
    RUNNABLE_KEYS_BUCKET: 'runnable.image-builder',
    RUNNABLE_DEPLOYKEY: 'flaming-octo-nemesis.key'
  };
  lab.beforeEach(function (done) {
    Object.keys(requiredEnvVars).forEach(
      function (key) { process.env[key] = requiredEnvVars[key]; });
    done();
  });
  lab.beforeEach(function (done) {
    childProcess.exec('rm -rf ' + cacheDir + '/*', done);
  });
  lab.beforeEach(steps.makeWorkingFolders.bind(steps));
  lab.beforeEach({ timeout: 5000 }, steps.downloadDeployKeys.bind(steps));
  lab.beforeEach(steps.chmodAllKeys.bind(steps));

  lab.experiment('succeeds', function () {

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

    lab.experiment('when there is no repo', function () {
      lab.beforeEach(function (done) {
        delete process.env.RUNNABLE_REPO;
        done();
      });
      lab.afterEach(function (done) {
        process.env.RUNNABLE_REPO = requiredEnvVars.RUNNABLE_REPO;
        done();
      });

      lab.it('just continues', function (done) {
        steps.getRepositories(function (err) {
          if (err) { return done(err); }
          // TODO look for no repos
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
        childProcess.exec(cmds, done);
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

    lab.experiment('when the repo has already been cached', function () {
      lab.beforeEach({ timeout: 10000 }, function (done) {
        var cmds = [
          'mkdir',
          '-p',
          cacheDir + '/bkendall',
          '&& git clone https://github.com/bkendall/flaming-octo-nemesis ' +
          cacheDir + '/bkendall/flaming-octo-nemesis'
        ].join(' ');
        childProcess.exec(cmds, done);
      });

      /* github can be slow to respond. long timeout */
      lab.test('to still complete', { timeout: 10000 }, function (done) {
        steps.getRepositories(function (err) {
          if (err) { return done(err); }
          var repoCacheDir = path.join(
            cacheDir,
            'bkendall/flaming-octo-nemesis');
          var repoGitDir = path.join(
            cacheDir,
            'bkendall/flaming-octo-nemesis',
            '.git');
          var repoCacheDirLock = path.join(
            cacheDir,
            'bkendall/flaming-octo-nemesis.lock');
          var repoTargetDir = path.join(
            steps.dirs.dockerContext,
            'flaming-octo-nemesis');
          expect(fs.existsSync(repoCacheDir)).to.be.true();
          expect(fs.existsSync(repoGitDir)).to.be.true();
          expect(fs.existsSync(repoCacheDirLock)).to.be.false();
          expect(fs.existsSync(repoTargetDir)).to.be.true();
          done();
        });
      });

      lab.experiment('but needing to be updated', function () {
        lab.beforeEach(function (done) {
          var cmd = 'git checkout 04d07787dd44b4f2167e26532e95471871a9b233';
          var cwd = cacheDir + '/bkendall/flaming-octo-nemesis';
          childProcess.exec(cmd, { cwd: cwd }, done);
        });
        lab.beforeEach(function (done) {
          sinon.spy(childProcess, 'exec');
          done();
        });
        lab.afterEach(function (done) {
          childProcess.exec.restore();
          done();
        });

        lab.test('to updated and complete', function (done) {
          steps.getRepositories(function (err) {
            if (err) { return done(err); }
            expect(childProcess.exec.calledWith('git fetch --all'))
              .to.be.true();
            expect(
              childProcess.exec.calledWith('git checkout -q ' +
                '34a728c59e713b7fbf5b0d6ed3a8e4f4e2c695c5'))
              .to.be.true();
            done();
          });
        });
      });
    });
  });

  lab.experiment('fails', function () {

    lab.experiment('when there is a repo, but no commitish', function () {
      lab.beforeEach(function (done) {
        delete process.env.RUNNABLE_COMMITISH;
        done();
      });
      lab.afterEach(function (done) {
        process.env.RUNNABLE_COMMITISH = requiredEnvVars.RUNNABLE_COMMITISH;
        done();
      });

      lab.it('just continues', function (done) {
        steps.getRepositories(function (err) {
          expect(err).to.exist();
          expect(err.message).to.match(/COMMITISH is missing/);
          done();
        });
      });
    });

    lab.experiment('to make sure the cache directory exists', function () {
      lab.beforeEach(function (done) {
        sinon.stub(childProcess, 'exec')
          .withArgs('mkdir -p /tmp/cache')
          .callsArgWith(
            1,
            new Error('Command failed'),
            '',
            '');
        done();
      });
      lab.afterEach(function (done) {
        childProcess.exec.restore();
        done();
      });

      lab.it('returns an error', function (done) {
        steps.getRepositories(function (err) {
          expect(err).to.exist();
          expect(err.message).to.match(/Command failed/);
          done();
        });
      });
    });

    lab.experiment('to remove all the ssh keys from agent', function () {
      lab.beforeEach(function (done) {
        sinon.stub(childProcess, 'exec');
        childProcess.exec
          .withArgs('ssh-add -D')
          .callsArgWith(
            1,
            new Error('Command failed'),
            '',
            '');
        childProcess.exec.yields(null, '', '');
        done();
      });
      lab.afterEach(function (done) {
        childProcess.exec.restore();
        done();
      });

      lab.it('returns an error', function (done) {
        steps.getRepositories(function (err) {
          expect(err).to.exist();
          expect(err.message).to.match(/Command failed/);
          done();
        });
      });
    });

    lab.experiment('to make the lock file directory', function () {
      lab.beforeEach(function (done) {
        sinon.stub(childProcess, 'exec');
        childProcess.exec
          .withArgs('mkdir -p /tmp/cache/bkendall')
          .callsArgWith(
            1,
            new Error('Command failed'),
            '',
            '');
        childProcess.exec.yields(null, '', '');
        done();
      });
      lab.afterEach(function (done) {
        childProcess.exec.restore();
        done();
      });

      lab.it('returns an error', function (done) {
        steps.getRepositories(function (err) {
          expect(err).to.exist();
          expect(err.message).to.match(/Command failed/);
          done();
        });
      });
    });

    lab.experiment('to release the lock', function () {
      lab.beforeEach(function (done) {
        sinon.stub(lockfile, 'unlock');
        lockfile.unlock
          .callsArgWith(1, new Error('could not unlock'));
        done();
      });
      lab.afterEach(function (done) {
        lockfile.unlock.restore();
        done();
      });

      lab.it('returns an error', { timeout: 10000 }, function (done) {
        steps.getRepositories(function (err) {
          expect(err).to.exist();
          expect(err.message).to.match(/could not unlock/);
          // should have tried to unlock it twice
          expect(lockfile.unlock.callCount).to.equal(2);
          done();
        });
      });
    });
  });
});
