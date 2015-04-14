'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var it = lab.test;

var nock = require('nock');

var Signal = require('../../lib/external/signal-client.js');

lab.experiment('signal-client.js', function () {
  lab.experiment('attachHostToContainer', function () {
    lab.beforeEach(function (done) {
      process.env.RUNNABLE_DOCKER = 'http://localhost:5555';
      done();
    });
    lab.afterEach(function (done){
      nock.cleanAll();
      delete process.env.RUNNABLE_DOCKER;
      done();
    });
    it('should send SIGINT to container', function (done) {
      var signal = new Signal(1, 1);
      nock(process.env.RUNNABLE_DOCKER, { allowUnmocked: true })
        .post('/containers/123456/kill?signal=SIGINT')
        .reply(204);

      signal.attachHostToContainer(1, 1, { containerId: 123456 },
        function (err, res) {
          if (err) { return done(err); }
          expect(res.statusCode).to.equal(200);
          done();
        });
    });
    it('should return 500 statusCode', function (done) {
      var signal = new Signal(1, 1);
      process.env.SAURON_FAIL = 'true';
      signal.attachHostToContainer(1, 1, { containerId: 123456 },
        function (err, res) {
          delete process.env.SAURON_FAIL;
          expect(err).to.exist();
          expect(res.statusCode).to.equal(500);
          done();
        });
    });
  });
  lab.experiment('should error if invalid params', function () {
    it('should throw if no host', function (done) {
      try {
        new Signal(null, 1);
      } catch (err) {
        return done();
      }
      done(new Error('should have errored'));
    });
    it('should throw if no port', function (done) {
      try {
        new Signal(1, null);
      } catch (err) {
        return done();
      }
      done(new Error('should have errored'));
    });
  });
});
