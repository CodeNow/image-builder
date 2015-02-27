'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

lab.test('we need environment variables to run the tests', function (done) {
  var keys = [
    'AWS_ACCESS_KEY',
    'AWS_SECRET_KEY'
  ];
  keys.forEach(function (key) {
    expect(process.env[key]).to.not.be.undefined().and.not.equal('');
  });
  done();
});
