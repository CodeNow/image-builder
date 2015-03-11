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
lab.before(function (done) {
  Object.keys(requiredEnvVars).forEach(function (key) {
    process.env[key] = requiredEnvVars[key];
  });
  done();
});

lab.experiment('downloadBuildFiles', function () {
  var requiredEnvVars = {
    RUNNABLE_FILES: '{ "Dockerfile": "K6cluDupwQdFRsuTPJ0SFUrxUB4lmF_Q" }',
    RUNNABLE_FILES_BUCKET: 'runnable.image-builder',
    RUNNABLE_PREFIX: ''
  };
  lab.beforeEach(function (done) {
    Object.keys(requiredEnvVars).forEach(
      function (key) { process.env[key] = requiredEnvVars[key]; });
    done();
  });
  lab.before(steps.makeWorkingFolders.bind(steps));

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

    lab.experiment('if prefix is missing', function () {
      lab.beforeEach(function (done) {
        delete process.env.RUNNABLE_PREFIX;
        done();
      });
      lab.afterEach(function (done) {
        process.env.RUNNABLE_PREFIX = requiredEnvVars.RUNNABLE_PREFIX;
        done();
      });

      lab.test('it should be fine', function (done) {
        steps.downloadBuildFiles(function (err) {
          if (err) { return done(err); }
          // TODO check directory
          done();
        });
      });
    });

    lab.experiment('using a prefix', function () {
      lab.beforeEach(function (done) {
        process.env.RUNNABLE_FILES =
          '{ "test-prefix/Dockerfile": "VHSTXUoj_1n9970ysq69lu6V6owCzarr" }';
        process.env.RUNNABLE_PREFIX = 'test-prefix/';
        done();
      });
      lab.afterEach(function (done) {
        process.env.RUNNABLE_PREFIX = requiredEnvVars.RUNNABLE_PREFIX;
        process.env.RUNNABLE_FILES = requiredEnvVars.RUNNABLE_FILES;
        done();
      });

      lab.it('should remove the prefix', function (done) {
        steps.downloadBuildFiles(function (err) {
          if (err) { return done(err); }
          // TODO check for empty directory
          done();
        });
      });
    });

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

    lab.experiment('with files to download', function () {

      lab.test('to download the files', function (done) {
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

  lab.experiment('fails', function () {

    lab.experiment('when the files are not formatted well', function () {
      lab.beforeEach(function (done) {
        process.env.RUNNABLE_FILES ='{ "Dockerfile": \'versionid\' }';
        done();
      });
      lab.afterEach(function (done) {
        process.env.RUNNABLE_FILES = requiredEnvVars.RUNNABLE_FILES;
        done();
      });

      lab.it('should throw an error', function (done) {
        steps.downloadBuildFiles(function (err) {
          expect(err).to.exist();
          expect(err.message).to.match(/poorly formatted/);
          done();
        });
      });
    });
  });
});
