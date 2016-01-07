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
        sinon.spy(ErrorCat.prototype, 'createAndReport');
        sinon.stub(ErrorCat.prototype, 'report').yieldsAsync();
        done();
      });
      afterEach(function (done) {
        ErrorCat.prototype.createAndReport.restore();
        ErrorCat.prototype.report.restore();
        done();
      });

      it('should cb error if push errors', function (done) {
        var testErr = 'sauron attacks';
        mockObj.push.yieldsAsync(testErr);
        model.pushImage(testImage, function (err) {
          console.error('huh', err)
          expect(err.output.statusCode).to.equal(500);
          expect(err.message).to.equal('Image failed to start push.');
          expect(err.data.err).to.be.equal(testErr);
          done();
        });
      });

      it('should report the error w/ error cat (defaults)', function (done) {
        var error = new Error();
        mockObj.push.yieldsAsync(error);
        model.pushImage(testImage, function (err) {
          expect(err.message).to.equal('Image failed to start push.');
          sinon.assert.calledOnce(ErrorCat.prototype.createAndReport);
          sinon.assert.calledWithExactly(
            ErrorCat.prototype.createAndReport,
            500,
            'Image failed to start push.',
            sinon.match.has('imageId', testImage),
            sinon.match.func
          );
          done();
        });
      });

      it('should report the error w/ error cat (dockerode)', function (done) {
        var error = new Error('barbaz');
        error.statusCode = 404;
        mockObj.push.yieldsAsync(error);
        model.pushImage(testImage, function (err) {
          expect(err.message).to.equal('barbaz');
          sinon.assert.calledOnce(ErrorCat.prototype.createAndReport);
          sinon.assert.calledWithExactly(
            ErrorCat.prototype.createAndReport,
            404,
            'barbaz',
            sinon.match.has('imageId', testImage),
            sinon.match.func
          );
          done();
        });
      });

      it('should report progress errors (string)', function (done) {
        var error = 'this is an error';
        mockObj.push.yieldsAsync();
        model.docker.modem.followProgress.callsArgWithAsync(1, error);
        model.pushImage(testImage, function (err) {
          expect(err).to.exist();
          expect(err.message).to.equal(error);
          sinon.assert.calledOnce(ErrorCat.prototype.createAndReport);
          sinon.assert.calledWithExactly(
            ErrorCat.prototype.createAndReport,
            502,
            error,
            sinon.match.has('imageId', testImage),
            sinon.match.func
          );
          done();
        });
      });

      it('should report progress errors (error objects)', function (done) {
        var error = new Error('this is an error');
        error.statusCode = 508;
        mockObj.push.yieldsAsync();
        model.docker.modem.followProgress.callsArgWithAsync(1, error);
        model.pushImage(testImage, function (err) {
          expect(err).to.exist();
          expect(err.message).to.equal('this is an error');
          sinon.assert.calledOnce(ErrorCat.prototype.createAndReport);
          sinon.assert.calledWithExactly(
            ErrorCat.prototype.createAndReport,
            508,
            'this is an error',
            sinon.match.has('imageId', testImage),
            sinon.match.func
          );
          done();
        });
      });
    });
  }); // end pushImage
}); // end ImageDelivery
