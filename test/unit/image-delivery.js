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
var ErrorCat = require('error-cat');
var ImageDelivery = require('../../lib/steps/image-delivery.js');

describe('ImageDelivery unit test', function () {
  var model;
  beforeEach(function (done) {
    process.env.RUNNABLE_DOCKER = 'http://some.docker.host:4234';
    model = new ImageDelivery();
    sinon.stub(model.docker.modem, 'followProgress').yieldsAsync();
    sinon.stub(console, 'log');
    done();
  });
  afterEach(function (done) {
    delete process.env.RUNNABLE_DOCKER;
    model.docker.modem.followProgress.restore();
    console.log.restore();
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

    it('should push image', function (done) {
      mockObj.push.yieldsAsync();
      model.pushImage(testImage, function (err) {
        expect(err).to.not.exist();
        sinon.assert.calledOnce(Dockerode.prototype.getImage);
        sinon.assert.calledWithExactly(
          Dockerode.prototype.getImage,
          testImageName
        );
        sinon.assert.calledOnce(mockObj.push);
        sinon.assert.calledWithExactly(
          mockObj.push,
          { tag: testTag },
          sinon.match.func
        );
        done();
      });
    });

    describe('errors', function () {
      beforeEach(function (done) {
        sinon.stub(ErrorCat.prototype, 'createAndReport');
        done();
      });
      afterEach(function (done) {
        ErrorCat.prototype.createAndReport.restore();
        done();
      });

      it('should cb error if push errors', function (done) {
        var testErr = 'sauron attacks';
        mockObj.push.yieldsAsync(testErr);
        model.pushImage(testImage, function (err) {
          expect(err).to.be.equal(testErr);
          done();
        });
      });

      it('should report the error w/ error cat (defaults)', function (done) {
        var error = new Error();
        mockObj.push.yieldsAsync(error);
        model.pushImage(testImage, function (err) {
          expect(err).to.equal(error);
          sinon.assert.calledOnce(ErrorCat.prototype.createAndReport);
          sinon.assert.calledWithExactly(
            ErrorCat.prototype.createAndReport,
            500,
            'Image failed to push.',
            sinon.match.has('imageId', testImage)
          );
          done();
        });
      });

      it('should report the error w/ error cat (dockerode)', function (done) {
        var error = new Error('foobar');
        error.statusCode = 404;
        error.message = 'barbaz';
        mockObj.push.yieldsAsync(error);
        model.pushImage(testImage, function (err) {
          expect(err).to.equal(error);
          sinon.assert.calledOnce(ErrorCat.prototype.createAndReport);
          sinon.assert.calledWithExactly(
            ErrorCat.prototype.createAndReport,
            404,
            'barbaz',
            sinon.match.has('imageId', testImage)
          );
          done();
        });
      });
    });

  }); // end pushImage
}); // end ImageDelivery
