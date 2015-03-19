'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

var childProcess = require('child_process');
var path = require('path');
var fs = require('fs');
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
lab.beforeEach(function (done) {
  Object.keys(requiredEnvVars).forEach(function (key) {
    process.env[key] = requiredEnvVars[key];
    expect(requiredEnvVars[key]).to.not.be.undefined();
  });
  done();
});
lab.afterEach(function (done) {
  Object.keys(requiredEnvVars).forEach(function (key) {
    delete process.env[key];
  });
  done();
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
    // provide options to check that exec was called
    lab.beforeEach(function (done) {
      sinon.spy(childProcess, 'exec');
      done();
    });
    lab.afterEach(function (done) {
      childProcess.exec.restore();
      done();
    });

    lab.experiment('when there are keys', function () {
      lab.beforeEach({ timeout: 5000 }, steps.downloadDeployKeys.bind(steps));
      lab.beforeEach(function (done) { childProcess.exec.reset(); done(); });

      lab.test('to set the permissions on the keys', function (done) {
        steps.chmodAllKeys(function (err) {
          if (err) { return done(err); }
          expect(childProcess.exec.calledOnce).to.be.true();
          expect(childProcess.exec.calledWith('chmod -R 600 *')).to.be.true();
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

    lab.experiment('when there are no keys', function () {
      var oldDeployKey;
      lab.beforeEach(function (done) {
        oldDeployKey = process.env.RUNNABLE_DEPLOYKEY;
        delete process.env.RUNNABLE_DEPLOYKEY;
        done();
      });
      lab.afterEach(function (done) {
        process.env.RUNNABLE_DEPLOYKEY = oldDeployKey;
        done();
      });
      lab.beforeEach(function (done) { childProcess.exec.reset(); done(); });

      lab.test('to just move on', function (done) {
        steps.chmodAllKeys(function (err) {
          if (err) { return done(err); }
          expect(childProcess.exec.callCount).to.equal(0);
          done();
        });
      });
    });
  });

  lab.experiment('fails', function () {
    lab.beforeEach({ timeout: 5000 }, steps.downloadDeployKeys.bind(steps));

    lab.experiment('when the exec call fails', function () {
      lab.beforeEach(function (done) {
        sinon.stub(childProcess, 'exec', function () {
          var cb = Array.prototype.slice.call(arguments).pop();
          cb(
            new Error('Command failed'),
            '',
            'chmod: cannot access ‘*’: No such file or directory\n');
        });
        done();
      });
      lab.afterEach(function (done) {
        childProcess.exec.restore();
        done();
      });

      lab.it('should return an error', function (done) {
        steps.chmodAllKeys(function (err) {
          expect(require('child_process').exec.calledOnce).to.be.true();
          expect(err).to.exist();
          done();
        });
      });
    });
  });
});
