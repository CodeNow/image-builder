'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

var docker = require('../../lib/external/docker.js');

lab.experiment('docker.js unit test', function () {
  lab.afterEach(function(done) {
    delete process.env.RUNNABLE_DOCKER;
    done();
  });
  lab.experiment('valid', function () {
    lab.it('should setup unix socket', function(done) {
      var socket = '/var/lib/docker';
      process.env.RUNNABLE_DOCKER = 'unix://'+socket;
      var d = docker();
      expect(d.modem.socketPath).to.equal(socket);
      done();
    });
    lab.it('should setup with remote', function(done) {
      var host = '10.234.129.94';
      var port = '5354';
      var remote = 'tcp://'+host+':'+port;
      process.env.RUNNABLE_DOCKER = remote;
      var d = docker();
      expect(d.modem.host).to.equal(host);
      expect(d.modem.port).to.equal(port);
      done();
    });
  });
  lab.experiment('invalid', function () {
    lab.it('should throw if RUNNABLE_DOCKER not set', function(done) {
      try {
        docker();
      } catch (err) {
        return done();
      }
      done(new Error('should have thrown'));
    });
    lab.it('should throw if RUNNABLE_DOCKER has invalid input', function(done) {
      ['google',
      'unix',
      'unix:/bad/place',
      'http://',
      'http://google',
      'http://:235',
      ':235',
      'google:123']
      .forEach(function(testItem) {
        process.env.RUNNABLE_DOCKER = testItem;
        try {
          docker();
        } catch (err) {
          return done();
        }
        done(new Error(testItem+'should have thrown'));
      });
    });
  });
});