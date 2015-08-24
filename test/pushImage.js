'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var expect = require('code').expect;
var after = lab.after;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var sinon = require('sinon');

var ImageDelivery = require('../lib/steps/image-delivery.js');

describe('pushImage.js test', function () {
  beforeEach(function(done) {
    process.env.RUNNABLE_DOCKER = 'http://fake.host:4242';
    process.env.RUNNABLE_DOCKERTAG = 'registry.runnable.com/111/222:333';
    done();
  });

  beforeEach(function(done) {
    sinon.stub(process, 'exit').returns();
    sinon.stub(ImageDelivery.prototype, 'pushImage');
    done();
  });

  afterEach(function(done) {
    // flush cache because this is a script
    delete require.cache[require.resolve('../lib/pushImage.js')];
    process.exit.restore();
    ImageDelivery.prototype.pushImage.restore();
    done();
  });

  after(function(done) {
    delete process.env.RUNNABLE_DOCKER;
    delete process.env.RUNNABLE_DOCKERTAG;
    done();
  });

  describe('missing env', function () {
    beforeEach(function(done) {
      ImageDelivery.prototype.pushImage.returns();
      done();
    });

    lab.test('exit with 128', function (done) {
      delete process.env.RUNNABLE_DOCKER;
      require('../lib/pushImage.js');
      expect(process.exit.withArgs(128).called).to.be.true();
      expect(ImageDelivery.prototype.pushImage.called).to.be.false();
      done();
    });

    lab.test('exit with 128', function (done) {
      delete process.env.RUNNABLE_DOCKERTAG;
      require('../lib/pushImage.js');
      expect(process.exit.withArgs(128).called).to.be.true();
      expect(ImageDelivery.prototype.pushImage.called).to.be.false();
      done();
    });
  }); // end missing tags

  describe('valid env', function () {
    lab.test('exit with 1 on push fail', function (done) {
      ImageDelivery.prototype.pushImage.yields(new Error('fireball'));
      require('../lib/pushImage.js');
      expect(process.exit.withArgs(1).called).to.be.true();
      expect(ImageDelivery.prototype.pushImage.called).to.be.true();
      done();
    });

    lab.test('exit with 0 on success', function (done) {
      ImageDelivery.prototype.pushImage.yields();
      require('../lib/pushImage.js');
      expect(process.exit.withArgs(0).called).to.be.true();
      expect(ImageDelivery.prototype.pushImage.called).to.be.true();
      done();
    });
  }); // end missing tags
}); // end pushImage.js test