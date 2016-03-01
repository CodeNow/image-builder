'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

var childProcess = require('child_process');
var sinon = require('sinon');

// require this after we have now changed the env for the directories
var steps = require('../../lib/steps');

lab.experiment('makeWorkingFolders', function () {
  lab.beforeEach(function (done) {
    sinon.stub(childProcess, 'execFile')
      .yieldsAsync(null, new Buffer(''), new Buffer(''));
    done();
  });

  lab.afterEach(function (done) {
    childProcess.execFile.restore();
    done();
  });

  lab.experiment('succeeds', function () {
    lab.test('to create all folders', function (done) {
      steps.makeWorkingFolders(function (err) {
        if (err) { return done(err); }
        sinon.assert.callCount(childProcess.execFile, 5);
        sinon.assert.calledWith(
          childProcess.execFile,
          'mktemp',
          [
            '-d',
            sinon.match(/rnnbl\.X/)
          ]
        );
        sinon.assert.calledWith(
          childProcess.execFile,
          'mktemp',
          [
            '-d',
            sinon.match(/rnnbl\.key\.X/)
          ]
        );
        done();
      });
    });
  });

  lab.experiment('fails', function () {
    lab.experiment('to create a folder', function () {
      lab.beforeEach(function (done) {
        childProcess.execFile
          .withArgs('mktemp', ['-d', '/tmp/rnnbl.key.XXXXXXXXXXXXXXXXXXXX'])
          .yieldsAsync(new Error('Command failed'));
        done();
      });

      lab.test('on an exec call', function (done) {
        steps.makeWorkingFolders(function (err) {
          expect(err).to.exist();
          expect(err.message).to.match(/command failed/i);
          done();
        });
      });
    });

    lab.experiment('to create a file', function () {
      lab.beforeEach(function (done) {
        childProcess.execFile
          .withArgs('mktemp', ['/tmp/rnnbl.ib.stdout.XXXXXXXXXXXXXXXXXXXX'])
          .yieldsAsync(new Error('Command failed'));
        done();
      });

      lab.test('on an exec call', function (done) {
        steps.makeWorkingFolders(function (err) {
          expect(err).to.exist();
          expect(err.message).to.match(/command failed/i);
          done();
        });
      });
    });
  });
});
