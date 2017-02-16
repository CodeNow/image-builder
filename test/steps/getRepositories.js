'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

var childProcess = require('child_process');
var path = require('path');
var fs = require('fs');
var sinon = require('sinon');

var lockfile = require('lockfile');

var steps = require('../../lib/steps');

lab.experiment('getRepositories', function () {
  var requiredEnvVars = {
    RUNNABLE_REPO: 'git@github.com:bkendall/flaming-octo-nemesis',
    RUNNABLE_COMMITISH: '34a728c59e713b7fbf5b0d6ed3a8e4f4e2c695c5',
    RUNNABLE_KEYS_BUCKET: 'runnable.image-builder',
    RUNNABLE_DEPLOYKEY: 'flaming-octo-nemesis.key'
  };
  lab.beforeEach(function (done) {
    Object.keys(requiredEnvVars).forEach(function (key) {
      process.env[key] = requiredEnvVars[key];
    });
    steps.dirs = {};
    steps.dirs.dockerContext = '/tmp/rnnbl.XXXXXXXXXXXXXXXXXXXX';
    steps.dirs.keyDirectory = '/tmp/rnnbl.key.XXXXXXXXXXXXXXXXXXXX';
    steps.logs = {};
    steps.logs.dockerBuild = '/tmp/rnnbl.log.XXXXXXXXXXXXXXXXXXXX';
    steps.logs.stdout = '/tmp/rnnbl.ib.stdout.XXXXXXXXXXXXXXXXXXXX';
    steps.logs.stderr = '/tmp/rnnbl.ib.stderr.XXXXXXXXXXXXXXXXXXXX';
    done();
  });

  lab.beforeEach(function (done) {
    sinon.stub(childProcess, 'execFile')
      .yields(null, new Buffer(''), new Buffer(''));
    sinon.stub(steps, 'saveToLogs', function (cb) {
      return function (err, stdout, stderr) {
        cb(
          err,
          stdout ? stdout.toString() : '', stderr ? stderr.toString() : ''
        );
      };
    });
    sinon.stub(lockfile, 'lock').yields(null, true);
    sinon.stub(lockfile, 'unlock').yields(null);
    done();
  });

  lab.afterEach(function (done) {
    childProcess.execFile.restore();
    steps.saveToLogs.restore();
    lockfile.lock.restore();
    lockfile.unlock.restore();
    done();
  });

  lab.experiment('succeeds', function () {
    lab.experiment('when there is a repo', function () {
      lab.beforeEach(function (done) {
        childProcess.execFile.yieldsAsync(null, new Buffer(''), new Buffer(''));
        done();
      });

      lab.test('to download the repo', function (done) {
        // no lock, so it returns true
        steps.getRepositories(function (err) {
          if (err) { return done(err); }
          sinon.assert.calledWith(
            childProcess.execFile,
            'git',
            [
              'clone',
              '-q',
              'git@github.com:bkendall/flaming-octo-nemesis',
              '/cache/bkendall/flaming-octo-nemesis'
            ]
          );
          sinon.assert.calledWith(
            childProcess.execFile,
            'git',
            [
              'checkout',
              '-q',
              '34a728c59e713b7fbf5b0d6ed3a8e4f4e2c695c5'
            ]
          );
          sinon.assert.calledWith(
            childProcess.execFile,
            'cp',
            [
              '-p',
              '-r',
              '-d',
              sinon.match.string,
              sinon.match.string
            ]
          );
          sinon.assert.calledOnce(lockfile.lock);
          sinon.assert.calledOnce(lockfile.unlock);
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
        // cannot get the lock => false
        lockfile.lock.yields(new Error());
        done();
      });

      lab.test('to download the repo', function (done) {
        steps.getRepositories(function (err) {
          if (err) { return done(err); }
          sinon.assert.calledWith(
            childProcess.execFile,
            'git',
            [
              'clone',
              '-q',
              sinon.match.string,
              sinon.match.string
            ]
          );
          sinon.assert.calledWith(
            childProcess.execFile,
            'git',
            [
              'checkout',
              '-q',
              sinon.match.string
            ]
          );
          expect(childProcess.execFile.calledWithMatch('cp')).to.be.false();
          done();
        });
      });
    });

    lab.experiment('when the repo has already been cached', function () {
      var repoGitDir = path.join(
        '/cache',
        'bkendall/flaming-octo-nemesis',
        '.git');

      lab.beforeEach(function (done) {
        childProcess.execFile.yieldsAsync(null, new Buffer(''), new Buffer(''));
        sinon.stub(fs, 'existsSync').withArgs(repoGitDir).returns(true);
        done();
      });

      lab.afterEach(function (done) {
        fs.existsSync.restore();
        done();
      });

      lab.test('to still complete', function (done) {
        steps.getRepositories(function (err) {
          if (err) { return done(err); }
          expect(fs.existsSync.calledWithExactly(repoGitDir)).to.be.true();
          expect(childProcess.execFile.calledWithMatch('git',
            ['clone', '-q', sinon.match.string]))
            .to.be.false();
          expect(childProcess.execFile.calledWithMatch('git',
            ['fetch', '--prune', '--all']))
            .to.be.true();
          expect(childProcess.execFile.calledWithMatch('cp')).to.be.true();
          expect(lockfile.lock.calledOnce).to.be.true();
          done();
        });
      });

      lab.experiment('but needing to be updated', function () {
        lab.beforeEach(function (done) {
          childProcess.execFile
            .withArgs('git', ['rev-parse', 'HEAD'])
            .yields(
              null,
              new Buffer('04d07787dd44b4f2167e26532e95471871a9b233'),
              new Buffer(''));
          done();
        });

        lab.test('to updated and complete', function (done) {
          steps.getRepositories(function (err) {
            if (err) { return done(err); }
            sinon.assert.calledWith(
              childProcess.execFile,
              'git',
              [
                'fetch',
                '--prune',
                '--all'
              ]
            );
            sinon.assert.calledWith(
              childProcess.execFile,
              'git',
              [
                'checkout',
                '-q',
                '34a728c59e713b7fbf5b0d6ed3a8e4f4e2c695c5'
              ]
            );
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
        childProcess.execFile
          .withArgs('mkdir', ['-p', '/cache'])
          .callsArgWith(2, new Error('Command failed'), '', '');
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
        childProcess.execFile
          .withArgs('ssh-add', ['-D'])
          .callsArgWith(2, new Error('Command failed'), '', '');
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
        childProcess.execFile
          .withArgs('mkdir', ['-p', '/cache/bkendall'])
          .callsArgWith(2, new Error('Command failed'), '', '');
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
        lockfile.unlock.yields(new Error('could not unlock'));
        done();
      });

      lab.it('returns an error', function (done) {
        steps.getRepositories(function (err) {
          expect(err).to.exist();
          expect(err.message).to.match(/could not unlock/);
          // should have tried to unlock it twice
          sinon.assert.calledTwice(lockfile.unlock);
          done();
        });
      });
    });
  });
});
