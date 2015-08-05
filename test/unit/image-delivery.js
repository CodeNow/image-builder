'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var afterEach = lab.afterEach;
var beforeEach = lab.beforeEach;
var Code = require('code');
var expect = Code.expect;
var sinon = require('sinon');
var Dockerode = require('dockerode');
var ImageDelivery = require('../../lib/steps/image-delivery.js');

describe('ImageDelivery unit test', function () {
  var model;
  beforeEach(function (done) {
    process.env.RUNNABLE_DOCKER = 'http://some.docker.host:4234';
    model = new ImageDelivery();
    sinon.stub(model.docker.modem, 'followProgress').yieldsAsync();
    done();
  });
  afterEach(function (done) {
    delete process.env.RUNNABLE_DOCKER;
    model.docker.modem.followProgress.restore();
    done();
  });
  describe('pushImage', function () {
    var testTag = 'lothlorien';
    var testImageName = 'registy.runnable.com/1234/galadriel';
    var testImage = testImageName + ':' + testTag;
    var mockObj = {
      push: sinon.stub()
    };
    beforeEach(function (done) {
      sinon.stub(Dockerode.prototype, 'getImage').returns(mockObj);
      done();
    });
    afterEach(function (done) {
      Dockerode.prototype.getImage.restore();
      done();
    });

    it('should pull image', function (done) {
      mockObj.push.yieldsAsync();
      model.pushImage(testImage, function (err) {
        expect(err).to.not.exist();
        expect(Dockerode.prototype.getImage
          .withArgs(testImageName)
          .calledOnce).to.be.true();
        expect(mockObj.push
          .withArgs({
            tag: testTag
          })
          .calledOnce).to.be.true();
        done();
      });
    });

    it('should cb error', function (done) {
      var testErr = 'sauron attacks';
      mockObj.push.yieldsAsync(testErr);
      model.pushImage(testImage, function (err) {
        expect(err).to.be.equal(testErr);
        done();
      });
    });
  }); // end pushImage
}); // end ImageDelivery