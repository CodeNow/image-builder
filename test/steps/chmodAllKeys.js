'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

var childProcess = require('child_process');
var path = require('path');
var fs = require('fs');
var sinon = require('sinon');

// require this after we have now changed the env for the directories
var steps = require('../../lib/steps');

lab.experiment('chmodAllKeys', function () {
  var requiredEnvVars = {
    RUNNABLE_KEYS_BUCKET: 'runnable.image-builder',
    RUNNABLE_DEPLOYKEY: 'flaming-octo-nemesis.key'
  };
  lab.beforeEach(function (done) {
    Object.keys(requiredEnvVars).forEach(function (key) {
      process.env[key] = requiredEnvVars[key];
    });
    sinon.stub(steps, 'saveToLogs', function (cb) {
      return function (err, stdout, stderr) { cb(err, stdout, stderr); }
    });
    sinon.stub(childProcess, 'execFile').yieldsAsync(null);
    done();
  });

  lab.afterEach(function (done) {
    steps.saveToLogs.restore();
    childProcess.execFile.restore();
    done();
  })

  lab.experiment('succeeds', function () {
    lab.experiment('when there are keys', function () {
      lab.test('to set the permissions on the keys', function (done) {
        steps.chmodAllKeys(function (err) {
          if (err) { return done(err); }
          sinon.assert.calledOnce(childProcess.execFile)
          sinon.assert.calledWith(
            childProcess.execFile,
            'chmod',
            [ '-R', '600', '*' ]
          );
          done();
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

      lab.test('to just move on', function (done) {
        steps.chmodAllKeys(function (err) {
          if (err) { return done(err); }
          sinon.assert.notCalled(childProcess.execFile);
          done();
        });
      });
    });
  });

  lab.experiment('fails', function () {
    lab.experiment('when the execFile call fails', function () {
      lab.beforeEach(function (done) {
        childProcess.execFile.yieldsAsync(
          new Error('Command failed'),
          '',
          'chmod: cannot access ‘*’: No such file or directory\n'
        );
        done();
      });

      lab.it('should return an error', function (done) {
        steps.chmodAllKeys(function (err) {
          expect(err).to.exist();
          sinon.assert.calledOnce(childProcess.execFile);
          done();
        });
      });
    });
  });
});
