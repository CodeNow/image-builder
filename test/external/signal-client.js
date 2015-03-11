'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var it = lab.test;
var nock = require('nock');

var Signal = require('../../lib/external/signal-client.js');

lab.experiment('signal-client.js', function () {
  lab.experiment('attachHostToContainer', function () {
    it('should send SIGINT to container', function(done) {
      var signal = new Signal(1,1);
      nock('http://'+process.env.RUNNABLE_DOCKER)
        .post('/containers/123456/kill?signal=SIGINT')
        .reply(204);

      signal.attachHostToContainer(1,1,123456, function(err, res) {
        if (err) { return done(err); }
        expect(res.statusCode).to.equal(200);
        done();
      });
    });
    it('should return 500 statusCode', function(done) {
      var signal = new Signal(1,1);
      process.env.SAURON_FAIL = 'true';
      signal.attachHostToContainer(1,1,123456, function(err, res) {
        delete process.env.SAURON_FAIL;
        if (err) { return done(err); }
        expect(res.statusCode).to.equal(500);
        done();
      });
    });
  });
  lab.experiment('detachHostFromContainer', function () {
    it('should return 200 statusCode', function(done) {
      var signal = new Signal(1,1);
      signal.detachHostFromContainer(1,1,123456, function(err, res) {
        if (err) { return done(err); }
        expect(res.statusCode).to.equal(200);
        done();
      });
    });
  });
});