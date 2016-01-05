'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = require('code').expect;

var ErrorCat = require('error-cat');
var errorCat = require('../../lib/external/error-cat.js');

describe('ErrorCat', function () {
  it('should expose an errorcat instance', function (done) {
    expect(errorCat).to.be.an.instanceOf(ErrorCat);
    done();
  });
});
