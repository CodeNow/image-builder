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

  lab.experiment('succeeds', function () {

    lab.experiment('when there is a repo', function () {
      lab.test('to download the repo', function (done) {
        // no lock, so it returns true
        sinon.stub(lockfile, 'lock').yields(null, true);
        sinon.stub(lockfile, 'unlock').yields(null);
        sinon.stub(childProcess, 'execFile')
          .yields(null, new Buffer(''), new Buffer(''));
        steps.getRepositories(function (err) {
          if (err) { return done(err); }
          expect(childProcess.execFile.calledWithMatch('git', ['clone', '-q', sinon.match.string]))
            .to.be.true();
          expect(childProcess.execFile.calledWithMatch('git', ['checkout', sinon.match.string]))
            .to.be.true();
          expect(childProcess.execFile.calledWithMatch('cp'))
            .to.be.true();
          childProcess.execFile.restore();
          expect(lockfile.lock.calledOnce).to.be.true();
          expect(lockfile.unlock.calledOnce).to.be.true();
          lockfile.lock.restore();
          lockfile.unlock.restore();
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
      lab.test('to download the repo', function (done) {
        // cannot get the lock => false
        sinon.stub(lockfile, 'lock').yields(new Error());
        sinon.stub(lockfile, 'unlock').yields();
        sinon.stub(childProcess, 'execFile')
          .yields(null, new Buffer(''), new Buffer(''));
        steps.getRepositories(function (err) {
          if (err) { return done(err); }
          expect(childProcess.execFile.calledWithMatch('git', ['clone', '-q', sinon.match.string]))
            .to.be.true();
          expect(childProcess.execFile.calledWithMatch('git', ['checkout', sinon.match.string]))
            .to.be.true();
          expect(childProcess.execFile.calledWithMatch('cp')).to.be.false();
          expect(lockfile.lock.calledOnce).to.be.true();
          expect(lockfile.unlock.called).to.be.false();
          lockfile.lock.restore();
          lockfile.unlock.restore();
          childProcess.execFile.restore();
          done();
        });
      });
    });

    lab.experiment('when the repo has already been cached', function () {
      lab.test('to still complete', function (done) {
        var repoGitDir = path.join(
          cacheDir,
          'bkendall/flaming-octo-nemesis',
          '.git');
        sinon.stub(lockfile, 'lock').yields(null);
        sinon.stub(lockfile, 'unlock').yields(null);
        sinon.stub(fs, 'existsSync').withArgs(repoGitDir).returns(true);
        sinon.stub(childProcess, 'execFile')
          .yields(null, new Buffer(''), new Buffer(''));
        steps.getRepositories(function (err) {
          if (err) { return done(err); }
          expect(fs.existsSync.calledWithExactly(repoGitDir)).to.be.true();
          expect(childProcess.execFile.calledWithMatch('git', ['clone', '-q', sinon.match.string]))
            .to.be.false();
          expect(childProcess.execFile.calledWithMatch('git', ['fetch', '--all']))
            .to.be.true();
          expect(childProcess.execFile.calledWithMatch('cp')).to.be.true();
          expect(lockfile.lock.calledOnce).to.be.true();
          lockfile.lock.restore();
          lockfile.unlock.restore();
          fs.existsSync.restore();
          childProcess.execFile.restore();
          done();
        });
      });

      lab.experiment('but needing to be updated', function () {
        lab.test('to updated and complete', function (done) {
          var repoGitDir = path.join(
            cacheDir,
            'bkendall/flaming-octo-nemesis',
            '.git');
          sinon.stub(lockfile, 'lock').yields(null);
          sinon.stub(lockfile, 'unlock').yields(null);
          sinon.stub(fs, 'existsSync').withArgs(repoGitDir).returns(true);
          sinon.stub(childProcess, 'execFile')
            .withArgs('git', ['rev-parse', 'HEAD'])
            .yields(
              null,
              new Buffer('04d07787dd44b4f2167e26532e95471871a9b233'),
              new Buffer(''));
          sinon.stub(childProcess, 'execFile')
            .yields(null, new Buffer(''), new Buffer(''));
          steps.getRepositories(function (err) {
            if (err) { return done(err); }
            expect(childProcess.execFile.calledWith('git', ['fetch', '--all']))
              .to.be.true();
            expect(
              childProcess.execFile.calledWith('git', [
                'checkout',
                '-q ',
                '34a728c59e713b7fbf5b0d6ed3a8e4f4e2c695c5'
              ]))
              .to.be.true();
            lockfile.lock.restore();
            lockfile.unlock.restore();
            fs.existsSync.restore();
            childProcess.execFile.restore();
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
        sinon.stub(childProcess, 'execFile')
          .withArgs('mkdir', ['-p', '/tmp/cache'])
          .callsArgWith(
            1,
            new Error('Command failed'),
            '',
            '');
        done();
      });
      lab.afterEach(function (done) {
        childProcess.execFile.restore();
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
        sinon.stub(childProcess, 'execFile');
        childProcess.execFile
          .withArgs('ssh-add', ['-D'])
          .callsArgWith(
            1,
            new Error('Command failed'),
            '',
            '');
        childProcess.execFile.yields(null, '', '');
        done();
      });
      lab.afterEach(function (done) {
        childProcess.execFile.restore();
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
        sinon.stub(childProcess, 'execFile');
        childProcess.execFile
          .withArgs('mkdir', ['-p', '/tmp/cache/bkendall'])
          .callsArgWith(
            1,
            new Error('Command failed'),
            '',
            '');
        childProcess.execFile.yields(null, '', '');
        done();
      });
      lab.afterEach(function (done) {
        childProcess.execFile.restore();
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
      lab.it('returns an error', function (done) {
        sinon.stub(childProcess, 'execFile')
          .yields(null, new Buffer(''), new Buffer(''));
        sinon.stub(lockfile, 'lock').yields(null);
        sinon.stub(lockfile, 'unlock').yields(new Error('could not unlock'));
        steps.getRepositories(function (err) {
          expect(err).to.exist();
          expect(err.message).to.match(/could not unlock/);
          // should have tried to unlock it twice
          expect(lockfile.unlock.callCount).to.equal(2);
          childProcess.execFile.restore();
          lockfile.unlock.restore();
          lockfile.lock.restore();
          done();
        });
      });
    });
  });
});
