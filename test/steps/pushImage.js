'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var before = lab.before;
var after = lab.after;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var sinon = require('sinon');
var childProcess = require('child_process');

var steps = require('../../lib/steps');

lab.experiment('pushImage', function () {
  before(function(done) {
    process.env.RUNNABLE_DOCKER = 'http://fake.host:4242';
    process.env.RUNNABLE_DOCKERTAG = 'registry.runnable.com/111/222:333';
    process.env.RUNNABLE_IMAGE_BUILDER_NAME = 'builder';
    process.env.RUNNABLE_IMAGE_BUILDER_TAG = '1738';

    sinon.stub(steps, 'saveToLogs', function (cb) {
      return cb;
    });
    done();
  });
  beforeEach(function(done) {
    sinon.stub(childProcess, 'exec').yieldsAsync();
    done();
  });
  afterEach(function(done) {
    childProcess.exec.restore();
    done();
  });
  after(function(done) {
    delete process.env.RUNNABLE_DOCKER;
    delete process.env.RUNNABLE_DOCKERTAG;
    delete process.env.RUNNABLE_IMAGE_BUILDER_NAME;
    delete process.env.RUNNABLE_IMAGE_BUILDER_TAG;
    steps.saveToLogs.restore();
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
      steps.pushImage(function (err) {
        expect(err).to.be.undefined();
        sinon.assert.calledWith(
          childProcess.exec,
          'docker --host http://fake.host:4242 run -d ' +
          '--label="type=imagePush" --restart=on-failure:5 ' +
          '-e "RUNNABLE_DOCKER=http://fake.host:4242" ' +
          '-e "RUNNABLE_DOCKERTAG=registry.runnable.com/111/222:333" ' +
          '-e "NODE_ENV=test" ' +
          ' builder:1738 node ./lib/push-image.js'
        );
        done();
      });
    });
  });
  lab.experiment('with push image not defined', function () {
    lab.test('should not push image', function (done) {
      steps.pushImage(function (err) {
        expect(err).to.be.undefined();
        expect(childProcess.exec.called).to.be.false();
        done();
      });
    });
  });
});
