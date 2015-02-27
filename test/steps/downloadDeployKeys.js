'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

var path = require('path');
var fs = require('fs');

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
