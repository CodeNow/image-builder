'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

var childProcess = require('child_process');
var sinon = require('sinon');

var dockerMock = require('docker-mock');
var nock = require('nock');

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

lab.experiment('parseBuildLogAndHistory', function () {
  var dockerMockServer;
  lab.before(function (done) {
    // this lets things through to docker mock. because nock.
    nock('http://localhost:5555', { allowUnmocked: true })
      .get('/_').reply(202);
    dockerMockServer = dockerMock.listen(5555, done);
  });
  lab.after(function (done) {
    dockerMockServer.close(done);
  });
  var requiredEnvVars = {
    RUNNABLE_DOCKER: 'tcp://localhost:5555',
    RUNNABLE_DOCKERTAG: 'test-docker-tag',
    RUNNABLE_FILES: '{ "Dockerfile": "AolcUvaTfKOFJg74ABqL9NN08333MS_t" }',
    RUNNABLE_FILES_BUCKET: 'runnable.image-builder'
  };
  lab.beforeEach(function (done) {
    Object.keys(requiredEnvVars).forEach(function (key) {
      process.env[key] = requiredEnvVars[key];
    });
    done();
  });
  lab.beforeEach(function (done) {
    childProcess.exec('rm -rf ' + layerCacheDir + '/*', done);
  });

  lab.experiment('succeeds', function () {
    lab.beforeEach(steps.makeWorkingFolders.bind(steps));

    lab.experiment('with runnable-cache', function () {
      lab.beforeEach({ timeout: 5000 }, steps.downloadBuildFiles.bind(steps));
      lab.beforeEach(steps.runDockerBuild.bind(steps));

      lab.test('should catch the cached layer', function (done) {
        steps.parseBuildLogAndHistory(function (err) {
          if (err) { return done(err); }
          expect(steps.data.cacheThisLayer).to.be.match(/^[a-f0-9]+$/);
          done();
        });
      });
      lab.test('should have a large buffer', function (done) {
        sinon.spy(childProcess, 'exec');
        steps.parseBuildLogAndHistory(function (err) {
          if (err) { return done(err); }
          sinon.assert.calledWith(
            childProcess.exec,
            /docker .+history.+/,
            { maxBuffer: 1024 * 5000 },
            sinon.match.func
          );
          childProcess.exec.restore();
          done();
        });
      });
    });

    lab.experiment('with funky runnable-cache', function () {
      lab.beforeEach(function (done) {
        process.env.RUNNABLE_FILES =
          '{ "Dockerfile": "KKUneazEu5iFAJAkfOIHe0C2jaeGgZpn" }';
        done();
      });
      lab.beforeEach({ timeout: 5000 }, steps.downloadBuildFiles.bind(steps));
      lab.beforeEach(steps.runDockerBuild.bind(steps));

      lab.test('should catch the cached layer', function (done) {
        steps.parseBuildLogAndHistory(function (err) {
          if (err) { return done(err); }
          expect(steps.data.cacheThisLayer).to.be.match(/^[a-f0-9]+$/);
          done();
        });
      });
    });

    lab.experiment('with an available layer cache', function () {
      lab.beforeEach(function (done) {
        var cmds = [
          'mkdir -p ' + layerCacheDir + '/test-docker-tag',
          'touch ' + layerCacheDir + '/test-docker-tag/' +
            '93f7657e7c42734aac70d134cecf53d3.tar'
        ].join(' && ');
        childProcess.exec(cmds, done);
      });
      lab.beforeEach({ timeout: 5000 }, steps.downloadBuildFiles.bind(steps));
      lab.beforeEach(steps.parseDockerfile.bind(steps));
      lab.beforeEach(steps.runDockerBuild.bind(steps));
      lab.beforeEach(function (done) {
        expect(!!steps.data.usingCache).to.be.true();
        done();
      });
      lab.beforeEach(function (done) {
        sinon.spy(childProcess, 'exec');
        done();
      });
      lab.afterEach(function (done) {
        childProcess.exec.restore();
        done();
      });

      lab.test('should just skip through if using cache', function (done) {
        steps.parseBuildLogAndHistory(function (err) {
          if (err) { return done(err); }
          // shouldn't call to docker to get the layer
          expect(childProcess.exec.callCount).to.equal(0);
          done();
        });
      });
    });
  });
});
