'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var sinon = require('sinon');

var tar = require('tar-fs');
var events = require('events');
var fs = require('fs');
var Builder = require('../../lib/steps/build.js');

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
    lab.it('should run tar and build', function (done) {
      var build = new Builder(defaultOps);
      var error = 'some error';
      sinon.stub(build, 'tarContext').yields(error);

      build.runDockerBuild(function (err) {
        if (err === error) { return done(); }
        done(new Error('should have errored'));
      });
    });
    lab.it('should run tar and build', function (done) {
      var build = new Builder(defaultOps);
      sinon.stub(build, 'tarContext').yields();
      sinon.stub(build, 'startImageBuild').yields();

      build.runDockerBuild(function (err) {
        if (err) { return done(err); }
        expect(build.tarContext.calledOnce).to.equal(true);
        expect(build.startImageBuild.calledOnce).to.equal(true);
        build.tarContext.restore();
        build.startImageBuild.restore();
        done();
      });
    });
  });

  lab.experiment('tarContext', function () {
    lab.it('should set tarPath and return on finish', function (done) {
      var finishEmitter = new events.EventEmitter();
      sinon.stub(fs , 'createWriteStream');
      sinon.stub(tar , 'pack').returns({
          pipe:  function () {
            return finishEmitter;
          }
        });
      var build = new Builder(defaultOps);
      build.tarContext(function (err) {
        if (err) { return done(err); }
        expect(
          fs.createWriteStream
            .withArgs(defaultOps.dirs.dockerContext+'.tar').calledOnce)
          .to.equal(true);
        expect(build.tarPath).to.equal(defaultOps.dirs.dockerContext+'.tar');
        tar.pack.restore();
        fs.createWriteStream.restore();
        done();
      });
      finishEmitter.emit('finish');
    });
  });

  lab.experiment('startImageBuild', function () {
    lab.it('should call buildImage with correct tag', function (done) {
      var build = new Builder(defaultOps);
      build.tarPath = '/test/path';

      sinon.stub(build.docker, 'buildImage',
        function (tarPath, opts, cb) {
          expect(tarPath).to.equal(build.tarPath);
          expect(opts).to.contain({ t: process.env.RUNNABLE_DOCKERTAG });
          cb();
        });

      sinon.stub(build, 'handleBuild').yields();

      build.startImageBuild(function(err) {
        if (err) { return done(err); }
        build.docker.buildImage.restore();
        build.handleBuild.restore();
        done();
      });
    });

    lab.it('should callback error is buildImage errored', function (done) {
      var build = new Builder(defaultOps);
      build.tarPath = '/test/path';

      sinon.stub(build.docker, 'buildImage',
        function (tarPath, opts, cb) {
          expect(tarPath).to.equal(build.tarPath);
          expect(opts).to.contain({ t: process.env.RUNNABLE_DOCKERTAG });
          cb('some error');
        });

      build.startImageBuild(function(err) {
        build.docker.buildImage.restore();
        if (err) {
          return done();
        }
        done(new Error('should have errored'));
      });
    });
  });

  lab.experiment('handleBuild', function () {
    lab.it('should call handleBuildData on data emit', function (done) {
      var build = new Builder(defaultOps);
      sinon.stub(build, 'handleBuildData', function () {
        build.handleBuildData.restore();
        done();
      });

      var dataEmitter = new events.EventEmitter();

      build.handleBuild(dataEmitter, function () {});
      dataEmitter.emit('data');
    });

    lab.it('should callback on end emit', function (done) {
      var build = new Builder(defaultOps);
      var dataEmitter = new events.EventEmitter();

      build.handleBuild(dataEmitter, done);
      dataEmitter.emit('end');
    });

    lab.it('should callback on error emit', function (done) {
      var build = new Builder(defaultOps);
      var dataEmitter = new events.EventEmitter();
      var error = 'some error';
      build.handleBuild(dataEmitter, function (err) {
        if (err === error) { return done(); }
        done(new Error('should have errored'));
      });
      dataEmitter.emit('error', error);
    });

    lab.it('should callback with error on end emit', function (done) {
      var build = new Builder(defaultOps);
      build.buildErr = 'some type of err';
      var dataEmitter = new events.EventEmitter();

      build.handleBuild(dataEmitter, function(err) {
        expect(err).to.equal(build.buildErr);
        done();
      });
      dataEmitter.emit('end');
    });
  });

  lab.experiment('handleBuildData', function () {
    lab.it('should set buildErr on error', function (done) {
      var stubFs = sinon.stub(fs , 'appendFileSync');
      var testErr = 'some error';
      var ops = {
        dirs: {
          dockerContext: '/test/context'
        },
        logs: {
          dockerBuild: '/test/log'
        },
        saveToLogs: function () {
          return function(err, stdout, stderr) {
            expect(stderr).to.equal(testErr);
          };
        }
      };
      var build = new Builder(ops);
      build.handleBuildData(JSON.stringify({error: testErr}));
      expect(build.buildErr).to.equal(testErr);
      expect(
        stubFs.withArgs(ops.logs.dockerBuild, testErr).calledOnce)
        .to.equal(true);
      stubFs.restore();
      done();
    });

    lab.it('should set waitForWeave if line match', function (done) {
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

      build.handleBuildData(JSON.stringify({stream: testString}));

      expect(build.needAttach).to.equal(true);
      expect(
        stubFs.withArgs(ops.logs.dockerBuild, testString).calledOnce)
        .to.equal(true);

      cleanWeaveEnv();
      stubFs.restore();
      done();
    });

    lab.it('should just print it not special line', function (done) {
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
      build.handleBuildData(JSON.stringify({stream: testString}));
      expect(build.needAttach).to.not.exist();
      expect(
        stubFs.withArgs(ops.logs.dockerBuild, testString).calledOnce)
        .to.equal(true);
      stubFs.restore();
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
        .stub(build , 'handleNetworkAttach', function (data) {
          expect(data).to.contain({stream: testString});
        });
      build.handleBuildData(JSON.stringify({stream: testString}));
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

  lab.describe('handleNetworkAttach', function() {
    lab.it('should ignore line if not running in', function(done) {
      setupWeaveEnv();
      var build = new Builder(defaultOps);
      sinon.stub(build.network, 'attach');
      build.handleNetworkAttach({ stream: 'test string' });
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
      build.handleNetworkAttach({ stream: testString });
    });
  });

  lab.describe('handleNetworkAttach', function() {
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

      build.postNetworkAttach(testContainerId)('some error');
    });

    lab.it('should do nothing if error', function(done) {
      var build = new Builder(defaultOps);
      var testContainerId = '132465789';

      sinon.stub(build.docker, 'getContainer',
        function() {
        throw new Error('should have been called');
      });

      build.postNetworkAttach(testContainerId)(null);
      // this again only works because it's syncronous
      build.docker.getContainer.restore();
      done();
    });
  });
});
