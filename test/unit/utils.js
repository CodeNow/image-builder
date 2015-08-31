'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var sinon = require('sinon');

var utils = require('../../lib/utils');

lab.experiment('utils', function () {
  lab.experiment('log', function () {
    lab.it('logs on log', function (done) {
      sinon.stub(console, 'log');
      var foo = 'something';
      var bar = 'else';
      utils.log(foo, bar);
      expect(console.log.calledOnce).to.be.true();
      console.log.restore();
      done();
    });
    lab.it('logs on error', function (done) {
      sinon.stub(console, 'error');
      var foo = 'something';
      var bar = 'else';
      utils.error(foo, bar);
      expect(console.error.calledOnce).to.be.true();
      console.error.restore();
      done();
    });
    lab.it('formats logs into an appropriate string', function (done) {
      sinon.stub(console, 'log');
      utils.log('a message');
      expect(console.log.calledOnce).to.be.true();
      var args = JSON.parse(console.log.getCall(0).args[0]);
      expect(args.type).to.equal('log');
      expect(args.content).to.deep.equal('a message\r\n');
      expect(Date.parse(args.timestamp)).to.be.about(Date.now(), 20);
      console.log.restore();
      done();
    });
    lab.it('formats objects to strings for the content', function (done) {
      sinon.stub(console, 'log');
      utils.progress({ some: 'object' });
      expect(console.log.calledOnce).to.be.true();
      var args = JSON.parse(console.log.getCall(0).args[0]);
      expect(args.type).to.equal('progress');
      expect(args.content).to.deep.equal({ some: 'object' });
      expect(Date.parse(args.timestamp)).to.be.about(Date.now(), 20);
      console.log.restore();
      done();
    });
    lab.it('does not add stuff to docker logs', function (done) {
      sinon.stub(console, 'log');
      utils.dockerLog('some stuff\n');
      expect(console.log.calledOnce).to.be.true();
      var args = JSON.parse(console.log.getCall(0).args[0]);
      expect(args.type).to.equal('docker');
      expect(args.content).to.deep.equal('some stuff\n');
      expect(Date.parse(args.timestamp)).to.be.about(Date.now(), 20);
      console.log.restore();
      done();
    });
    lab.it('logs a heartbeat', function (done) {
      sinon.stub(console, 'log');
      utils.heartbeat();
      expect(console.log.calledOnce).to.be.true();
      var args = JSON.parse(console.log.getCall(0).args[0]);
      expect(args.type).to.equal('heartbeat');
      var version = require('../../package.json').version;
      expect(args.content).to.deep.equal({version: version});
      expect(Date.parse(args.timestamp)).to.be.about(Date.now(), 20);
      console.log.restore();
      done();
    });
  });
});
