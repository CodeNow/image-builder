'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;
var sinon = require('sinon');
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
lab.experiment('build.js unit test', function () {

  lab.beforeEach(function (done) {
    ctx.RUNNABLE_DOCKER = process.env.RUNNABLE_DOCKER;
    process.env.RUNNABLE_DOCKER = 'localhost:4242';
    ctx.oldWait = process.env.RUNNABLE_WAIT_FOR_WEAVE;
    process.env.RUNNABLE_WAIT_FOR_WEAVE = 'waitForWeave; ';
    ctx.oldSauronHost = process.env.RUNNABLE_SAURON_HOST;
    process.env.RUNNABLE_SAURON_HOST = 'localhost:4242';
    ctx.oldDriver = process.env.RUNNABLE_NETWORK_DRIVER;
    process.env.RUNNABLE_NETWORK_DRIVER = 'signal';
    done();
  });
  lab.afterEach(function (done) {
    process.env.RUNNABLE_DOCKER = ctx.RUNNABLE_DOCKER;
    process.env.RUNNABLE_WAIT_FOR_WEAVE = ctx.oldWait;
    process.env.RUNNABLE_SAURON_HOST = ctx.oldSauronHost;
    process.env.RUNNABLE_NETWORK_DRIVER = ctx.oldDriver;
    ctx = {};
    done();
  });
  lab.experiment('new test', function () {
    lab.it('should load without envs', function(done) {
      delete process.env.RUNNABLE_WAIT_FOR_WEAVE;
      delete process.env.RUNNABLE_DOCKER;
      new Builder(defaultOps);
      done();
    });
  });
  lab.experiment('runDockerBuild', function () {
    lab.it('should run tar and build', function (done) {
      var build = new Builder(defaultOps);
      var stubTarContext = sinon.stub(build , 'tarContext', function (cb) {
        cb();
      });
      var stubBuildImage = sinon.stub(build , 'startImageBuild', function (cb) {
        cb();
      });

      build.runDockerBuild(function (err) {
        if (err) { return done(err); }
        expect(stubTarContext.calledOnce).to.equal(true);
        expect(stubBuildImage.calledOnce).to.equal(true);
        stubTarContext.restore();
        stubBuildImage.restore();
        done();
      });
    });
  });
  lab.experiment('tarContext', function () {
    lab.it('should set tarPath and return on finish', function (done) {
      var fs = require('fs');
      var stubFs = sinon.stub(fs , 'createWriteStream');

      var tar = require('tar-fs');
      var events = require('events');
      var finishEmitter = new events.EventEmitter();
      var stubPack = sinon.stub(tar , 'pack', function () {
        return {
          pipe:  function () {
            return finishEmitter;
          }
        };
      });
      var build = new Builder(defaultOps);
      build.tarContext(function (err) {
        if (err) { return done(err); }
        expect(
          stubFs.withArgs(defaultOps.dirs.dockerContext+'.tar').calledOnce)
          .to.equal(true);
        expect(build.tarPath)
          .to.equal(defaultOps.dirs.dockerContext+'.tar');
        stubPack.restore();
        stubFs.restore();
        done();
      });
      finishEmitter.emit('finish');
    });
  });
  lab.experiment('startImageBuild', function () {
    lab.it('should call buildImage with correct tag', function (done) {
      var docker = require('../../lib/external/docker.js');
      var build = new Builder(defaultOps);
      build.tarPath = '/test/path';

      var stubBuildImage = sinon.stub(docker , 'buildImage',
        function (tarPath, opts, cb) {
          expect(tarPath).to.equal(build.tarPath);
          expect(opts).to.contain({ t: process.env.RUNNABLE_DOCKERTAG });
          cb();
        });

      var stubHandleBuild = sinon.stub(build , 'handleBuild',
        function (res, cb) {
          cb();
      });

      build.startImageBuild(function(err) {
        if (err) { return done(err); }
        stubHandleBuild.restore();
        stubBuildImage.restore();
        done();
      });
    });
    lab.it('should callback error is buildImage errored', function (done) {
      var docker = require('../../lib/external/docker.js');
      var build = new Builder(defaultOps);
      build.tarPath = '/test/path';

      var stubBuildImage = sinon.stub(docker , 'buildImage',
        function (tarPath, opts, cb) {
          expect(tarPath).to.equal(build.tarPath);
          expect(opts).to.contain({ t: process.env.RUNNABLE_DOCKERTAG });
          cb('some error');
        });

      build.startImageBuild(function(err) {
        stubBuildImage.restore();
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
      var stubHandleBuildData = sinon
        .stub(build , 'handleBuildData', function () {
          stubHandleBuildData.restore();
          done();
        });

      var events = require('events');
      var dataEmitter = new events.EventEmitter();

      build.handleBuild(dataEmitter, done);
      dataEmitter.emit('data');
    });
    lab.it('should callback on end emit', function (done) {
      var build = new Builder(defaultOps);
      var events = require('events');
      var dataEmitter = new events.EventEmitter();

      build.handleBuild(dataEmitter, done);
      dataEmitter.emit('end');
    });
    lab.it('should callback with error on end emit', function (done) {
      var build = new Builder(defaultOps);
      build.buildErr = 'some type of err';
      var events = require('events');
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
      var fs = require('fs');
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


      var fs = require('fs');
      var stubFs = sinon.stub(fs , 'appendFileSync');
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

      stubFs.restore();
      done();
    });
    lab.it('should just print it not special line', function (done) {
      var fs = require('fs');
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
      var fs = require('fs');
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
    lab.it('should ignore if not running in', function(done) {
      var  network = require('../../lib/external/network.js');
      var stubAttach = sinon.stub(network , 'attach', function () {
        throw new Error('should not have gotten called');
      });
      var build = new Builder(defaultOps);
      var testString = 'using cache';
      build.handleNetworkAttach({stream: testString});

      stubAttach.restore();
      done();
    });
    lab.it('should call attach if Running in', function(done) {
      var testId = '1234312453215';
      var testString = 'Running in ' + testId + ' \n ';

      var  network = require('../../lib/external/network.js');
      var stubAttach = sinon.stub(network , 'attach',
        function (containerId, cb) {
          expect(containerId).to.equal(testId);
          cb();
      });
      var build = new Builder(defaultOps);

      var stubPostNetworkAttach = sinon.stub(build , 'postNetworkAttach',
        function () {
          stubAttach.restore();
          stubPostNetworkAttach.restore();
          done();
      });
      build.handleNetworkAttach({stream: testString});
    });
  });
  lab.describe('handleNetworkAttach', function() {
    lab.it('should kill container if error on attach', function(done) {
      var build = new Builder(defaultOps);
      var testContainerId = '132465789';

      var docker = require('../../lib/external/docker.js');
      var stubGetContainer = sinon.stub(docker , 'getContainer',
        function (containerId) {
          expect(containerId).to.equal(testContainerId);
          return {
            kill: function (cb) {
              cb();
            }
          };
      });
      var stubExit = sinon.stub(process , 'exit',
        function (code) {
          expect(code).to.equal(1);
          stubExit.restore();
          stubGetContainer.restore();
          done();
      });


      build.postNetworkAttach(testContainerId)('some error');
    });
    lab.it('should do nothing if error', function(done) {
      var build = new Builder(defaultOps);
      var testContainerId = '132465789';

      var docker = require('../../lib/external/docker.js');
      var stubGetContainer = sinon.stub(docker , 'getContainer',
        function() {
        throw new Error('should have been called');
      });

      build.postNetworkAttach(testContainerId)(null);

      stubGetContainer.restore();
      done();
    });
  });
});
