'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var beforeEach = lab.beforeEach;
var after = lab.after;
var expect = require('code').expect;
var sinon = require('sinon');
var Network = require('../../lib/external/network.js');

lab.experiment('network.js unit test', function () {
  beforeEach(function(done) {
    process.env.RUNNABLE_NETWORK_DRIVER = 'signal';
    process.env.RUNNABLE_SAURON_HOST = 'localhost:4242';
    process.env.RUNNABLE_NETWORK_IP = '10.0.0.0';
    process.env.RUNNABLE_HOST_IP = '10.0.0.1';
    done();
  });
  after(function(done) {
    delete process.env.RUNNABLE_NETWORK_DRIVER;
    delete process.env.RUNNABLE_SAURON_HOST;
    delete process.env.RUNNABLE_NETWORK_IP;
    delete process.env.RUNNABLE_HOST_IP;
    done();
  });
  lab.experiment('valid', function () {
    lab.it('should attach with correct args', function(done) {
      var network = new Network();
      sinon.stub(network.driver, 'attachHostToContainer').yields();
      network.attach('XXXXXXXX', done);
    });
    lab.it('should retry 4 times', { timeout: 10000 }, function(done) {
      var network = new Network();
      var count = 4;
      sinon.stub(network.driver, 'attachHostToContainer',
        function(ip, hip, opts, cb) {
          if (count > 0) {
            count--;
            cb('some error');
          } else {
            cb(null, 'good data');
          }
        });
      network.attach('XXXXXXXX', function(err, data) {
        if (err) { return done(err); }
        expect(data).to.equal('good data');
        done();
      });
    });
    lab.it('should error on 5th retry', { timeout: 10000 }, function(done) {
      var network = new Network();
      sinon.stub(network.driver, 'attachHostToContainer').yields('some error');
      network.attach('XXXXXXXX', function(err) {
        expect(err).to.equal('some error');
        done();
      });
    });
  });
  lab.experiment('invalid', function () {
    ['RUNNABLE_SAURON_HOST', 'RUNNABLE_NETWORK_IP',
    'RUNNABLE_HOST_IP', 'RUNNABLE_NETWORK_DRIVER']
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