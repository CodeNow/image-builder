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

lab.experiment('parseDockerfile', function () {
  var requiredEnvVars = {
    RUNNABLE_DOCKERTAG: 'test-docker-tag',
    RUNNABLE_FILES: '{ "Dockerfile": "AolcUvaTfKOFJg74ABqL9NN08333MS_t" }',
    RUNNABLE_FILES_BUCKET: 'runnable.image-builder'
  };
  lab.beforeEach(function (done) {
    Object.keys(requiredEnvVars).forEach(
      function (key) { process.env[key] = requiredEnvVars[key]; });
    done();
  });
  lab.beforeEach(function (done) {
    // have to do this to keep the steps.data bit clean between tests
    Object.keys(steps.data).forEach(function (key) {
      delete steps.data[key];
    });
    done();
  });
  lab.beforeEach(function (done) {
    childProcess.exec('rm -rf /tmp/layer-cache/*', done);
  });

  lab.experiment('succeeds', function () {
    lab.beforeEach(steps.makeWorkingFolders.bind(steps));

    lab.experiment('with runnable-cache', function () {
      lab.beforeEach({ timeout: 5000 }, steps.downloadBuildFiles.bind(steps));

      lab.test('should catch the cache line', function (done) {
        steps.parseDockerfile(function (err) {
          if (err) { return done(err); }
          expect(!!steps.data.usingCache).to.be.false();
          expect(steps.data.cachedLine).to.not.be.undefined();
          expect(steps.data.createdByHash).to.not.be.undefined();
          done();
        });
      });
    });

    lab.experiment('with funky Runnable-cache', function () {
      lab.beforeEach(function (done) {
        process.env.RUNNABLE_FILES =
          '{ "Dockerfile": "KKUneazEu5iFAJAkfOIHe0C2jaeGgZpn" }';
        done();
      });
      lab.afterEach(function (done) {
        process.env.RUNNABLE_FILES = requiredEnvVars.RUNNABLE_FILES;
        done();
      });
      lab.beforeEach({ timeout: 5000 }, steps.downloadBuildFiles.bind(steps));
      lab.beforeEach(function (done) {
        sinon.stub(childProcess, 'exec')
          .yields(
            new Error('Command failed: cp: /tmp/empty/file:' +
              'No such file or directory'),
            '', '');
        done();
      });
      lab.afterEach(function (done) {
        childProcess.exec.restore();
        done();
      });

      lab.test('should find the cached line', function (done) {
        steps.parseDockerfile(function (err) {
          if (err) { return done(err); }
          // not copying a cache
          expect(childProcess.exec.callCount).to.equal(1);
          expect(!!steps.data.usingCache).to.be.false();
          expect(steps.data.cachedLine).to.not.be.undefined();
          expect(steps.data.createdByHash).to.not.be.undefined();
          done();
        });
      });
    });

    lab.experiment('with no runnable-cache', function () {
      lab.beforeEach(function (done) {
        process.env.RUNNABLE_FILES =
          '{ "test-prefix/Dockerfile": "ir8FJ0g6CH9P608k4O0lscYNuAz6Yt5q" }';
        process.env.RUNNABLE_PREFIX = 'test-prefix/';
        done();
      });
      lab.afterEach(function (done) {
        process.env.RUNNABLE_FILES = requiredEnvVars.RUNNABLE_FILES;
        delete process.env.RUNNABLE_PREFIX;
        done();
      });
      lab.beforeEach({ timeout: 5000 }, steps.downloadBuildFiles.bind(steps));
      lab.beforeEach(function (done) {
        sinon.spy(childProcess, 'exec');
        done();
      });
      lab.afterEach(function (done) {
        childProcess.exec.restore();
        done();
      });

      lab.test('should not do any caching', function (done) {
        steps.parseDockerfile(function (err) {
          if (err) { return done(err); }
          // not copying a cache
          expect(childProcess.exec.callCount).to.equal(0);
          expect(!!steps.data.usingCache).to.be.false();
          expect(steps.data.cachedLine).to.be.undefined();
          expect(steps.data.createdByHash).to.be.undefined();
          done();
        });
      });
    });

    lab.experiment('with an available layer cache', function () {
      lab.beforeEach(function (done) {
        var cmds = [
          'mkdir -p /tmp/layer-cache/test-docker-tag',
          'touch /tmp/layer-cache/test-docker-tag/' +
            '93f7657e7c42734aac70d134cecf53d3.tar'
        ].join(' && ');
        childProcess.exec(cmds, done);
      });
      lab.beforeEach({ timeout: 5000 }, steps.downloadBuildFiles.bind(steps));
      lab.beforeEach(function (done) {
        sinon.spy(childProcess, 'exec');
        done();
      });
      lab.afterEach(function (done) {
        childProcess.exec.restore();
        done();
      });

      lab.test('should not do any caching', function (done) {
        steps.parseDockerfile(function (err) {
          if (err) { return done(err); }
          expect(!!steps.data.usingCache).to.be.true();
          expect(steps.data.cachedLine).to.not.be.undefined();
          expect(steps.data.createdByHash).to.not.be.undefined();
          // using a cache!
          expect(childProcess.exec.callCount).to.equal(1);
          done();
        });
      });
    });
  });
});
