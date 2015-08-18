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
      expect(console.log.getCall(0).args[0]).to.equal(JSON.stringify({
        type: 'log',
        content: 'a message\r\n'
      }));
      console.log.restore();
      done();
    });
    lab.it('formats objects to strings for the content', function (done) {
      sinon.stub(console, 'log');
      utils.progress({ some: 'object' });
      expect(console.log.calledOnce).to.be.true();
      expect(console.log.getCall(0).args[0]).to.equal(JSON.stringify({
        type: 'progress',
        content: { some: 'object' }
      }));
      console.log.restore();
      done();
    });
    lab.it('does not add stuff to docker logs', function (done) {
      sinon.stub(console, 'log');
      utils.dockerLog('some stuff\n');
      expect(console.log.calledOnce).to.be.true();
      expect(console.log.getCall(0).args[0]).to.equal(JSON.stringify({
        type: 'docker',
        content: 'some stuff\n'
      }));
      console.log.restore();
      done();
    });
  });
});
