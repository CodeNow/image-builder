'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

var childProcess = require('child_process');
var sinon = require('sinon');

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
    RUNNABLE_REPO: 'http://token@github.com/bkendall/flaming-octo-nemesis',
    RUNNABLE_COMMITISH: '34a728c59e713b7fbf5b0d6ed3a8e4f4e2c695c5'
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
        sinon.stub(childProcess, 'exec')
          .yields(null, new Buffer(''), new Buffer(''));
        steps.getRepositories(function (err) {
          if (err) { return done(err); }
          expect(childProcess.exec.calledWithMatch(/git clone .+/))
            .to.be.true();
          expect(childProcess.exec.calledWithMatch(/git clone .+/))
            .to.be.true();
          expect(childProcess.exec.calledWithMatch(/git checkout .+/))
            .to.be.true();
          expect(childProcess.exec.calledWithMatch(/git remote set-url origin .+/))
            .to.be.true();
          expect(childProcess.exec.callCount).to.equal(5);
          childProcess.exec.restore();
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
        sinon.stub(childProcess, 'exec')
          .yields(null, new Buffer(''), new Buffer(''));
        steps.getRepositories(function (err) {
          if (err) { return done(err); }
          expect(childProcess.exec.callCount).to.equal(0);
          childProcess.exec.restore();
          done();
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
  });
});
