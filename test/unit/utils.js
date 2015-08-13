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
        content: 'a message'
      }));
      console.log.restore();
      done();
    });
  });
});
