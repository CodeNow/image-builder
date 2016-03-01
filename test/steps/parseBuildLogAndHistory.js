'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

var childProcess = require('child_process');
var sinon = require('sinon');
var fs = require('fs');

// require this after we have now changed the env for the directories
var steps = require('../../lib/steps');

lab.experiment('parseBuildLogAndHistory', function () {
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
    var buildLog = [
      'Step 6 : EXPOSE 80 8000 8080 3000 # runnable-cache',
      '---> Running in 5de57dc5f332',
      'Successfully built deadbeef'
    ].join('\n');
    var historyString = [
      'beefdead 8 months ago is bad to eat # runnable-cache'
    ].join('\n');
    sinon.stub(childProcess, 'execFile')
      .yieldsAsync(null, new Buffer(''), new Buffer(''));
    childProcess.execFile
      .withArgs('docker')
      .yieldsAsync(null, new Buffer(historyString), new Buffer(''));
    sinon.stub(fs, 'readFileSync').returns(buildLog);
    sinon.stub(steps, 'saveToLogs', function (cb) {
      return function (err, stdout, stderr) {
        cb(
          err,
          stdout ? stdout.toString() : '', stderr ? stderr.toString() : ''
        );
      };
    });
    done();
  });

  lab.afterEach(function (done) {
    childProcess.execFile.restore();
    fs.readFileSync.restore();
    steps.saveToLogs.restore();
    done();
  });

  lab.experiment('succeeds', function () {
    lab.experiment('with runnable-cache', function () {
      lab.test('should catch the cached layer', function (done) {
        steps.parseBuildLogAndHistory(function (err) {
          if (err) { return done(err); }
          expect(steps.data.cacheThisLayer).to.be.match(/^[a-f0-9]+$/);
          done();
        });
      });

      lab.test('should have a large buffer', function (done) {
        steps.parseBuildLogAndHistory(function (err) {
          if (err) { return done(err); }
          sinon.assert.calledWith(
            childProcess.execFile,
            'docker',
            [
              '--host',
              sinon.match.string,
              'history',
              '--no-trunc',
              'deadbeef'
            ],
            { maxBuffer: 1024 * 5000 },
            sinon.match.func
          );
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

      lab.test('should catch the cached layer', function (done) {
        steps.parseBuildLogAndHistory(function (err) {
          if (err) { return done(err); }
          expect(steps.data.cacheThisLayer).to.be.equal('beefdead');
          done();
        });
      });
    });

    lab.experiment('with an available layer cache', function () {
      lab.beforeEach(function (done) {
        steps.data.usingCache = true;
        done();
      });

      lab.test('should just skip through if using cache', function (done) {
        steps.parseBuildLogAndHistory(function (err) {
          if (err) { return done(err); }
          // shouldn't call to docker to get the layer
          expect(childProcess.execFile.callCount).to.equal(0);
          done();
        });
      });
    });
  });
});
