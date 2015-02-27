'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

var childProcess = require('child_process');
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
  });
  done();
});

lab.experiment('makeWorkingFolders', function () {

  lab.experiment('succeeds', function () {
    lab.beforeEach(function (done) {
      sinon.spy(childProcess, 'exec');
      done();
    });
    lab.afterEach(function (done) {
      childProcess.exec.restore();
      done();
    });

    var createdFolders = [
      'dockerContext',
      'keyDirectory'
    ];
    lab.test('to create all folders', function (done) {
      steps.makeWorkingFolders(function (err) {
        if (err) { return done(err); }
        expect(childProcess.exec.callCount).to.equal(5);
        createdFolders.forEach(function (dirName) {
          expect(steps.dirs[dirName]).to.not.be.undefined();
          expect(fs.existsSync(steps.dirs[dirName])).to.be.true();
        });
        done();
      });
    });
  });

  lab.experiment('fails', function () {

    lab.experiment('to create a folder', function () {
      lab.beforeEach(function (done) {
        sinon.stub(childProcess, 'exec', function () {
          var args = Array.prototype.slice.call(arguments);
          var cb = args.pop();
          if (/mktemp \-d/.test(args[0])) {
            cb(
              new Error('Command failed'),
              '',
              '');
          } else {
            cb(null, '', '');
          }
        });
        done();
      });
      lab.afterEach(function (done) {
        childProcess.exec.restore();
        done();
      });

      lab.test('on an exec call', function (done) {
        steps.makeWorkingFolders(function (err) {
          expect(err).to.exist();
          done();
        });
      });
    });

    lab.experiment('to create a file', function () {
      lab.beforeEach(function (done) {
        sinon.stub(childProcess, 'exec', function () {
          var args = Array.prototype.slice.call(arguments);
          var cb = args.pop();
          if (/mktemp \//.test(args[0])) {
            cb(
              new Error('Command failed'),
              '',
              '');
          } else {
            cb(null, '', '');
          }
        });
        done();
      });
      lab.afterEach(function (done) {
        childProcess.exec.restore();
        done();
      });

      lab.test('on an exec call', function (done) {
        steps.makeWorkingFolders(function (err) {
          expect(err).to.exist();
          done();
        });
      });
    });
  });
});
