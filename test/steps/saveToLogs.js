'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

var steps = require('../../lib/steps');

lab.experiment('saveToLogs', function () {
  lab.test('should prevent stdout/stderr undefined', function (done) {
    var handleFunction = steps.saveToLogs(function (err, stdout, stderr) {
      expect(err).to.be.null();
      expect(stdout).to.equal('');
      expect(stderr).to.equal('');
      done();
    });

    handleFunction(null, undefined, null);
  });
});
