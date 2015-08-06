'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var before = lab.before;
var after = lab.after;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var sinon = require('sinon');
var ImageDelivery = require('../../lib/steps/image-delivery.js');

var steps = require('../../lib/steps');

lab.experiment('pushImage', function () {
  before(function(done) {
    process.env.RUNNABLE_DOCKER = 'http://fake.host:4242';
    done();
  });
  beforeEach(function(done) {
    sinon.stub(ImageDelivery.prototype, 'pushImage');
    done();
  });
  afterEach(function(done) {
    ImageDelivery.prototype.pushImage.restore();
    done();
  });
  after(function(done) {
    delete process.env.RUNNABLE_DOCKER;
    done();
  });
  lab.experiment('with push image defined', function () {
    before(function(done) {
      process.env.RUNNABLE_PUSH_IMAGE = true;
      done();
    });
    after(function(done) {
      delete process.env.RUNNABLE_PUSH_IMAGE;
      done();
    });
    lab.test('should push image', function (done) {
      ImageDelivery.prototype.pushImage.yieldsAsync();
      steps.pushImage(function (err) {
        expect(err).to.be.undefined();
        expect(ImageDelivery.prototype.pushImage
          .calledWith(process.env.RUNNABLE_DOCKERTAG))
          .to.be.true();
        done();
      });
    });
    lab.test('should set error if push failed', function (done) {
      ImageDelivery.prototype.pushImage.yieldsAsync(new Error('flop'));
      steps.pushImage(function (err) {
        expect(err.message).to.be.exist();
        expect(ImageDelivery.prototype.pushImage
          .calledWith(process.env.RUNNABLE_DOCKERTAG))
          .to.be.true();
        done();
      });
    });
  });
  lab.experiment('with push image not defined', function () {
    lab.test('should not push image', function (done) {
      ImageDelivery.prototype.pushImage.yieldsAsync();
      steps.pushImage(function (err) {
        expect(err).to.be.undefined();
        expect(ImageDelivery.prototype.pushImage.called).to.be.false();
        done();
      });
    });
  });
});