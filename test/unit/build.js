'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var after = lab.after;
var afterEach = lab.afterEach;
var before = lab.before;
var beforeEach = lab.beforeEach;
var Code = require('code');
var expect = Code.expect;

var sinon = require('sinon');
var createCount = require('callback-count');
var afterEach = afterEach;
var beforeEach = beforeEach;
var stream = require('stream');
var fs = require('fs');
var Builder = require('../../lib/steps/build.js');
var utils = require('../../lib/utils');

var defaultOps = {
  dirs: {
    dockerContext: '/test/context'
  },
  logs: {
    dockerBuild: '/test/log'
  },
  saveToLogs: function () {}
};

var ctx = {};

describe('build.js unit test', function () {
  beforeEach(function (done) {
    sinon.stub(utils, 'log');
    sinon.stub(utils, 'progress');
    sinon.stub(utils, 'error');
    sinon.stub(utils, 'dockerLog');
    done();
  });

  afterEach(function (done) {
    utils.log.restore();
    utils.progress.restore();
    utils.error.restore();
    utils.dockerLog.restore();
    done();
  });

  var saveEnvironmentVars = {
    'RUNNABLE_DOCKER': 'tcp://localhost:5555'
  };
  beforeEach(function (done) {
    Object.keys(saveEnvironmentVars).forEach(function (key) {
      ctx[key] = process.env[key];
      process.env[key] = saveEnvironmentVars[key];
    });
    done();
  });

  afterEach(function (done) {
    Object.keys(saveEnvironmentVars).forEach(function (key) {
      process.env[key] = ctx[key];
      delete ctx[key];
    });
    done();
  });

  describe('new test', function () {
    it('should load without envs', function(done) {
      delete process.env.RUNNABLE_DOCKER;
      new Builder(defaultOps);
      done();
    });
  });

  describe('runDockerBuild', function () {
    before(function(done) {
      process.env.RUNNABLE_DOCKERTAG = 'some-tag';
      done();
    });
    after(function(done) {
      delete process.env.RUNNABLE_DOCKERTAG;
      done();
    });
    it('should call buildImage with correct tag', function (done) {
      var build = new Builder(defaultOps);
      var testRes = 'some string';
      sinon.stub(build, '_getTarStream').returns(defaultOps.dirs.dockerContext);
      sinon.stub(build.docker, 'buildImage').yields(null, testRes);
      sinon.stub(build, '_handleBuild').yields();

      build.runDockerBuild(function(err) {
        if (err) { return done(err); }
        expect(build._getTarStream.calledOnce).to.be.true();
        expect(build.docker.buildImage
          .calledWith(defaultOps.dirs.dockerContext,
            { t: process.env.RUNNABLE_DOCKERTAG })).to.be.true();
        expect(build._handleBuild
          .calledWith(testRes)).to.be.true();

        build._getTarStream.restore();
        build.docker.buildImage.restore();
        build._handleBuild.restore();
        done();
      });
    });
    it('should call buildImage with extra flags', function (done) {
      process.env.RUNNABLE_BUILD_FLAGS = JSON.stringify({
        testFlag: 'dockerTestArgs',
        cpus: 100,
      });
      var build = new Builder(defaultOps);
      var testRes = 'some string';

      sinon.stub(build, '_getTarStream').returns(defaultOps.dirs.dockerContext);
      sinon.stub(build.docker, 'buildImage').yields(null, testRes);
      sinon.stub(build, '_handleBuild').yields();

      build.runDockerBuild(function(err) {
        if (err) { return done(err); }
        expect(build._getTarStream.calledOnce).to.be.true();
        expect(build.docker.buildImage
          .calledWith(defaultOps.dirs.dockerContext, {
            t: process.env.RUNNABLE_DOCKERTAG,
            cpus: 100,
            testFlag: 'dockerTestArgs'
          })).to.be.true();
        expect(build._handleBuild
          .calledWith(testRes)).to.be.true();

        build._getTarStream.restore();
        build.docker.buildImage.restore();
        build._handleBuild.restore();
        delete process.env.RUNNABLE_BUILD_FLAGS;
        done();
      });
    });
    it('should callback error is buildImage errored', function (done) {
      var build = new Builder(defaultOps);
      var someErr = 'test err';
      sinon.stub(build, '_getTarStream').returns(defaultOps.dirs.dockerContext);
      sinon.stub(build.docker, 'buildImage').yields(someErr);

      build.runDockerBuild(function(err) {
        expect(build._getTarStream.calledOnce).to.be.true();
        expect(build.docker.buildImage
          .calledWith(defaultOps.dirs.dockerContext,
            { t: process.env.RUNNABLE_DOCKERTAG })).to.be.true();

        build._getTarStream.restore();
        build.docker.buildImage.restore();
        if (err) {
          return done();
        }
        done(new Error('should have errored'));
      });
    });
  });

  describe('_getTarStream', function () {
    it('should create stream of current dir', function (done) {
      var ops = JSON.parse(JSON.stringify(defaultOps));
      ops.dirs.dockerContext = __dirname;
      var build = new Builder(ops);
      var tarS = build._getTarStream();
      expect(tarS.pipe).to.exist();
      done();
    });
  });

  describe('_handleBuild', function () {
    beforeEach(function (done) {
      ctx.builder = new Builder(defaultOps);
      sinon.stub(ctx.builder, 'saveToLogs', function (cb) {
        return cb;
      });
      done();
    });
    afterEach(function (done) {
      ctx.builder.saveToLogs.restore();
      done();
    });

    it('should handle data and end events', function (done) {
      // setup
      var dataStream = new stream.PassThrough();
      var count = createCount(1, function (err) {
        expect(ctx.builder._handleBuildData.calledOnce).to.be.true();
        ctx.builder._handleBuildData.restore();
        done(err);
      });

      // things to watch (for data)
      sinon.stub(ctx.builder, '_handleBuildData');

      // start handling stuff (count.next here is the exit event)
      ctx.builder._handleBuild(dataStream, count.next);

      // trigger the things!
      dataStream.write(JSON.stringify({ 'stream': 'RUN HELLO' }));
      dataStream.end();
    });

    it('should callback on error emit', function (done) {
      // setup
      var dataStream = new stream.PassThrough();
      var count = function (err) {
        expect(ctx.builder._handleBuildData.called).to.be.false();
        expect(err.message).to.equal('some error');
        ctx.builder._handleBuildData.restore();
        ctx.builder.docker.modem.followProgress.restore();
        done();
      };

      // things to watch (for data)
      // var error = new Error('some error');
      sinon.stub(ctx.builder, '_handleBuildData');
      sinon.stub(ctx.builder.docker.modem, 'followProgress',
        function (s, f) {
          // the final callback returns a String if there's an error.
          // seriously.
          f('some error');
        });

      // start handling stuff (count.next here is the exit event)
      ctx.builder._handleBuild(dataStream, count);
    });
  });

  describe('_handleBuildData', function () {
    var ops;
    var logStub;

    beforeEach(function (done) {
      logStub = sinon.stub();
      ops = {
        dirs: {
          dockerContext: '/test/context'
        },
        logs: {
          dockerBuild: '/test/log'
        },
        saveToLogs: function () {
          return logStub;
        }
      };
      sinon.stub(fs , 'appendFileSync');
      done();
    });

    afterEach(function (done) {
      fs.appendFileSync.restore();
      done();
    });

    it('should call progress if not stream', function (done) {


      var build = new Builder(ops);
      build._handleBuildData({other: 'testString'});
      expect(utils.progress.called).be.true();
      done();
    });

    it('should not print blacklisted line', function (done) {
      var testString = 'Removing intermediate container';

      var build = new Builder(ops);
      build._handleBuildData({stream: testString});
      expect(
        fs.appendFileSync.withArgs(ops.logs.dockerBuild, testString).calledOnce)
        .to.equal(true);
      expect(logStub.called).be.true();
      expect(utils.dockerLog.notCalled).be.true();
      done();
    });

    it('should print error', function (done) {
      var testString = 'error';

      var build = new Builder(ops);
      build._handleBuildData({
        stream: 'stream',
        error: testString
      });
      expect(
        fs.appendFileSync.withArgs(ops.logs.dockerBuild, testString).calledOnce)
        .to.equal(true);
      expect(logStub.called).be.true();
      done();
    });

    it('should just print if not special line', function (done) {
      var testString = '-----> using cache';

      var build = new Builder(ops);
      build._handleBuildData({stream: testString});
      expect(
        fs.appendFileSync.withArgs(ops.logs.dockerBuild, testString).calledOnce)
        .to.equal(true);
      done();
    });
  });
});
