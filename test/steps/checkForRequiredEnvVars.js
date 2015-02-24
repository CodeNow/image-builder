'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

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
