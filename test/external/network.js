'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var afterEach = lab.afterEach;
var beforeEach = lab.beforeEach;
var after = lab.after;
var expect = require('code').expect;
var sinon = require('sinon');

var Network = require('../../lib/external/network.js');
var childProcess = require('child_process');

lab.experiment('network.js unit test', function () {
  beforeEach(function(done) {
    process.env.RUNNABLE_CIDR = '32';
    process.env.RUNNABLE_WEAVE_PATH = '/bin/weave';
    process.env.RUNNABLE_HOST_IP = '10.0.0.1';
    done();
  });
  after(function(done) {
    delete process.env.RUNNABLE_CIDR;
    delete process.env.RUNNABLE_WEAVE_PATH;
    delete process.env.RUNNABLE_HOST_IP;
    done();
  });
  lab.experiment('valid', function () {
    beforeEach(function(done) {
      sinon.stub(childProcess, 'exec');
      done();
    });
    afterEach(function(done) {
      childProcess.exec.restore();
      done();
    });
    lab.it('should attach with correct args', function(done) {
      var testContainer = '1235123512365';
      childProcess.exec.yields();
      var network = new Network();
      network.attach(testContainer, function () {
        expect(childProcess.exec.withArgs(
          process.env.RUNNABLE_WEAVE_PATH +
          ' attach ' +
          process.env.RUNNABLE_HOST_IP + '/' +
          process.env.RUNNABLE_CIDR + ' ' +
          testContainer).called).to.be.true();
          done();
      });
    });
  });
  lab.experiment('invalid', function () {
    ['RUNNABLE_WEAVE_PATH', 'RUNNABLE_HOST_IP', 'RUNNABLE_CIDR']
    .forEach(function(item) {
      lab.it('should throw if '+item+' not set', function(done) {
        delete process.env[item];
        try {
          new Network();
        } catch(err) {
          return done();
        }
        done(new Error('should have thrown if missing'+item));
      });
    });
  });
});