'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var sinon = require('sinon');
var createCount = require('callback-count');

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
function setupWeaveEnv () {
  process.env.RUNNABLE_WAIT_FOR_WEAVE = 'waitForWeave; ';
  process.env.RUNNABLE_NETWORK_IP = '10.0.0.0';
  process.env.RUNNABLE_HOST_IP = '10.0.0.1';
}

function cleanWeaveEnv () {
  delete process.env.RUNNABLE_WAIT_FOR_WEAVE;
  delete process.env.RUNNABLE_NETWORK_IP;
  delete process.env.RUNNABLE_HOST_IP;
}

lab.experiment('build.js unit test', function () {
  lab.before(function (done) {
    sinon.stub(utils, 'log');
    sinon.stub(utils, 'progress');
    sinon.stub(utils, 'error');
    done();
  });
  lab.after(function (done) {
    utils.log.restore();
    utils.progress.restore();
    utils.error.restore();
    done();
  });

  var saveEnvironmentVars = {
    'RUNNABLE_DOCKER': 'tcp://localhost:5555',
    'RUNNABLE_SAURON_HOST': 'localhost:5555',
    'RUNNABLE_NETWORK_DRIVER': 'signal'
  };
  lab.beforeEach(function (done) {
    Object.keys(saveEnvironmentVars).forEach(function (key) {
      ctx[key] = process.env[key];
      process.env[key] = saveEnvironmentVars[key];
    });
    done();
  });
  lab.afterEach(function (done) {
    Object.keys(saveEnvironmentVars).forEach(function (key) {
      process.env[key] = ctx[key];
      delete ctx[key];
    });
    done();
  });

  lab.experiment('new test', function () {
    lab.it('should load without envs', function(done) {
      delete process.env.RUNNABLE_DOCKER;
      new Builder(defaultOps);
      done();
    });
  });

  lab.experiment('runDockerBuild', function () {
    lab.before(function(done) {
      process.env.RUNNABLE_DOCKERTAG = 'some-tag';
      done();
    });
    lab.after(function(done) {
      delete process.env.RUNNABLE_DOCKERTAG;
      done();
    });
    lab.it('should call buildImage with correct tag', function (done) {
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
    lab.it('should call buildImage with extra flags', function (done) {
      process.env.RUNNABLE_BUILD_FLAGS = JSON.stringify({
        testFlag: 'dockerTestArgs',
        cpus: 100
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
    lab.it('should callback error is buildImage errored', function (done) {
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

  lab.experiment('_getTarStream', function () {
    lab.it('should create stream of current dir', function (done) {
      var ops = JSON.parse(JSON.stringify(defaultOps));
      ops.dirs.dockerContext = __dirname;
      var build = new Builder(ops);
      var tarS = build._getTarStream();
      expect(tarS.pipe).to.exist();
      done();
    });
  });

  lab.experiment('_handleBuild', function () {
    lab.beforeEach(function (done) {
      ctx.builder = new Builder(defaultOps);
      sinon.stub(ctx.builder, 'saveToLogs').returns(function () {});
      done();
    });
    lab.afterEach(function (done) {
      ctx.builder.saveToLogs.restore();
      done();
    });

    lab.it('should handle data and end events', function (done) {
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

    lab.it('should callback on error emit', function (done) {
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
          f(new Error('some error'));
        });

      // start handling stuff (count.next here is the exit event)
      ctx.builder._handleBuild(dataStream, count);
    });
  });

  lab.experiment('_handleBuildData', function () {
    lab.it('should set waitForWeave if RUN line match', function (done) {
      var stubFs = sinon.stub(fs , 'appendFileSync');
      setupWeaveEnv();

      var testString = 'RUN ' +
        process.env.RUNNABLE_WAIT_FOR_WEAVE +
        ' sleep 100';

      var ops = {
        dirs: {
          dockerContext: '/test/context'
        },
        logs: {
          dockerBuild: '/test/log'
        },
        saveToLogs: function () {
          return function(err, stdout) {
            expect(stdout).to.equal(testString);
          };
        }
      };

      var build = new Builder(ops);

      build._handleBuildData({stream: testString});

      expect(build.needAttach).to.equal(true);
      expect(
        stubFs.withArgs(ops.logs.dockerBuild, testString).calledOnce)
        .to.equal(true);

      cleanWeaveEnv();
      stubFs.restore();
      done();
    });

    lab.it('should not waitForWeave if CMD line match', function (done) {
      var stubFs = sinon.stub(fs , 'appendFileSync');
      setupWeaveEnv();

      var testString = 'CMD ' +
        process.env.RUNNABLE_WAIT_FOR_WEAVE +
        ' sleep 100';

      var ops = {
        dirs: {
          dockerContext: '/test/context'
        },
        logs: {
          dockerBuild: '/test/log'
        },
        saveToLogs: function () {
          return function(err, stdout) {
            expect(stdout).to.equal(testString);
          };
        }
      };

      var build = new Builder(ops);

      build._handleBuildData({stream: testString});

      expect(build.needAttach).to.be.undefined();
      expect(
        stubFs.withArgs(ops.logs.dockerBuild, testString).calledOnce)
        .to.equal(true);

      cleanWeaveEnv();
      stubFs.restore();
      done();
    });

    lab.it('should not add waitForWeave to CMD w/ for non escaped regex',
      function (done) {
        var stubFs = sinon.stub(fs , 'appendFileSync');
        setupWeaveEnv();

        process.env.RUNNABLE_WAIT_FOR_WEAVE = 'echo | nc -q 0 localhost 5356';

        var testString = 'CMD ' +
          process.env.RUNNABLE_WAIT_FOR_WEAVE +
          ' sleep 100';

        var ops = {
          dirs: {
            dockerContext: '/test/context'
          },
          logs: {
            dockerBuild: '/test/log'
          },
          saveToLogs: function () {
            return function(err, stdout) {
              expect(stdout).to.equal(testString);
            };
          }
        };

        var build = new Builder(ops);

        build._handleBuildData({stream: testString});

        expect(build.needAttach).to.be.undefined();
        expect(
          stubFs.withArgs(ops.logs.dockerBuild, testString).calledOnce)
          .to.equal(true);

        cleanWeaveEnv();
        stubFs.restore();
        done();
    });

    lab.it('should not print blacklisted line', function (done) {
      var stubFs = sinon.stub(fs , 'appendFileSync');
      sinon.spy(process.stdout, 'write');
      var testString = 'Removing intermediate container';

      var ops = {
        dirs: {
          dockerContext: '/test/context'
        },
        logs: {
          dockerBuild: '/test/log'
        },
        saveToLogs: function () {
          return function(err, stdout) {
            expect(stdout).to.equal(testString);
          };
        }
      };

      var build = new Builder(ops);
      build._handleBuildData({stream: testString});
      expect(build.needAttach).to.not.exist();
      expect(
        stubFs.withArgs(ops.logs.dockerBuild, testString).calledOnce)
        .to.equal(true);
      expect(process.stdout.write.notCalled).be.true();
      process.stdout.write.restore();
      stubFs.restore();
      done();
    });

    lab.it('should just print if not special line', function (done) {
      var stubFs = sinon.stub(fs , 'appendFileSync');
      var testString = '-----> using cache';

      var ops = {
        dirs: {
          dockerContext: '/test/context'
        },
        logs: {
          dockerBuild: '/test/log'
        },
        saveToLogs: function () {
          return function(err, stdout) {
            expect(stdout).to.equal(testString);
          };
        }
      };

      var build = new Builder(ops);
      build._handleBuildData({stream: testString});
      expect(build.needAttach).to.not.exist();
      expect(
        stubFs.withArgs(ops.logs.dockerBuild, testString).calledOnce)
        .to.equal(true);
      stubFs.restore();
      done();
    });

    lab.it('should send a unique event for step starts', function (done) {
      var stubFs = sinon.stub(fs , 'appendFileSync');
      var testString = 'Step 1 : RUN mkdir $HOME/.ssh';

      var ops = {
        dirs: {
          dockerContext: '/test/context'
        },
        logs: {
          dockerBuild: '/test/log'
        },
        saveToLogs: function () {
          return function(err, stdout) {};
        }
      };

      sinon.stub(console, 'log');

      var build = new Builder(ops);
      build._handleBuildData({stream: testString});

      var lastCall = console.log.lastCall;
      sinon.assert.calledOnce(console.log);

      stubFs.restore();
      console.log.restore();

      expect(lastCall.args[0]).to.equal(JSON.stringify({
        type: 'event',
        content: {
          event: 'step',
          content: testString
        }
      }));
      done();
    });

    lab.it('should call network attach if attach needed', function (done) {
      var stubFs = sinon.stub(fs , 'appendFileSync');
      var testString = '234123512345';

      var ops = {
        dirs: {
          dockerContext: '/test/context'
        },
        logs: {
          dockerBuild: '/test/log'
        },
        saveToLogs: function () {
          return function(err, stdout) {
            expect(stdout).to.contain(testString);
          };
        }
      };

      var build = new Builder(ops);
      build.needAttach = true;
      var stubNetworkAttach= sinon
        .stub(build , '_handleNetworkAttach', function (data) {
          expect(data).to.equal(testString);
        });
      build._handleBuildData({stream: testString});
      expect(build.needAttach).to.equal(false);
      expect(
        stubFs.withArgs(ops.logs.dockerBuild, testString).calledOnce)
        .to.equal(true);
      expect(stubNetworkAttach.calledOnce).to.equal(true);
      stubFs.restore();
      stubNetworkAttach.restore();
      done();
    });
  });

  lab.describe('_handleNetworkAttach', function() {
    lab.it('should ignore line if not running in', function(done) {
      setupWeaveEnv();
      var build = new Builder(defaultOps);
      sinon.stub(build.network, 'attach');
      build._handleNetworkAttach('test string');
      expect(build.network.attach.called).to.equal(false);
      // this only works because it's synchronous
      build.network.attach.restore();
      cleanWeaveEnv();
      done();
    });
    lab.it('should call attach if Running in', function(done) {
      var testId = '1234312453215';
      var testString = 'Running in ' + testId + ' \n ';
      setupWeaveEnv();

      var build = new Builder(defaultOps);
      sinon.stub(build.network , 'attach',
        function (containerId) {
          expect(containerId).to.equal(testId);
          expect(build.network.attach.calledOnce).to.equal(true);
          build.network.attach.restore();
          cleanWeaveEnv();
          done();
      });
      build._handleNetworkAttach(testString);
    });
  });

  lab.describe('_postNetworkAttach', function() {
    lab.it('should kill container if error on attach', function(done) {
      var build = new Builder(defaultOps);
      var testContainerId = '132465789';

      sinon.stub(build.docker, 'getContainer',
        function (containerId) {
          expect(containerId).to.equal(testContainerId);
          return {
            kill: function (cb) {
              cb();
            }
          };
      });
      sinon.stub(process , 'exit',
        function (code) {
          expect(code).to.equal(1);
          build.docker.getContainer.restore();
          process.exit.restore();
          done();
      });

      build._postNetworkAttach(testContainerId)('some error');
    });

    lab.it('should do nothing if error', function(done) {
      var build = new Builder(defaultOps);
      var testContainerId = '132465789';

      sinon.stub(build.docker, 'getContainer',
        function() {
        throw new Error('should have been called');
      });

      build._postNetworkAttach(testContainerId)(null);
      // this again only works because it's syncronous
      build.docker.getContainer.restore();
      done();
    });
  });
});
