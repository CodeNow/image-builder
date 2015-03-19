'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

var childProcess = require('child_process');

var dockerMock = require('docker-mock');

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

lab.experiment('runDockerBuild', function () {
  var dockerMockServer;
  var waitForWeave = process.env.RUNNABLE_WAIT_FOR_WEAVE;
  lab.before(function (done) {
    delete process.env.RUNNABLE_WAIT_FOR_WEAVE;
    dockerMockServer = dockerMock.listen(5555, done);
  });
  lab.after(function (done) {
    process.env.RUNNABLE_WAIT_FOR_WEAVE = waitForWeave;
    dockerMockServer.close(done);
  });
  var requiredEnvVars = {
    RUNNABLE_DOCKER: 'tcp://localhost:5555',
    RUNNABLE_DOCKERTAG: 'test-docker-tag',
    RUNNABLE_FILES: '{ "Dockerfile": "K6cluDupwQdFRsuTPJ0SFUrxUB4lmF_Q" }',
    RUNNABLE_FILES_BUCKET: 'runnable.image-builder',
    RUNNABLE_DOCKER_BUILDOPTIONS: '--quiet=false'
  };
  lab.beforeEach(function (done) {
    Object.keys(requiredEnvVars).forEach(
      function (key) { process.env[key] = requiredEnvVars[key]; });
    done();
  });

  lab.experiment('succeeds', function () {
    lab.beforeEach(steps.makeWorkingFolders.bind(steps));
    lab.beforeEach({ timeout: 5000 }, steps.downloadBuildFiles.bind(steps));

    lab.experiment('if there is no docker build options', function () {
      lab.beforeEach(function (done) {
        delete process.env.RUNNABLE_DOCKER_BUILDOPTIONS;
        done();
      });

      lab.test('should build fine', function (done) {
        steps.runDockerBuild(function (err) {
          if (err) { return done(err); }
          var dockerArgs = [
            '--host ' + requiredEnvVars.RUNNABLE_DOCKER,
            'images'
          ].join(' ');
          childProcess.exec('docker ' + dockerArgs, function (err, stdout) {
            if (err) { return done(err); }
            expect(stdout.trim().split('\n')).to.have.length(2);
            done(err);
          });
        });
      });
    });

    lab.experiment('with all the envs', function () {
      lab.test('should call to docker', function (done) {
        steps.runDockerBuild(function (err) {
          if (err) { return done(err); }
          var dockerArgs = [
            '--host ' + requiredEnvVars.RUNNABLE_DOCKER,
            'images'
          ].join(' ');
          childProcess.exec('docker ' + dockerArgs, function (err, stdout) {
            if (err) { return done(err); }
            expect(stdout.trim().split('\n')).to.have.length(2);
            done(err);
          });
        });
      });
    });
  });
});
