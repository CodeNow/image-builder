'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var expect = require('code').expect;

var childProcess = require('child_process');
var sinon = require('sinon');
var fs = require('fs');

var steps = require('../../lib/steps');

lab.experiment('parseDockerfile', function () {
  var requiredEnvVars = {
    RUNNABLE_DOCKERTAG: 'test-docker-tag'
  };
  lab.beforeEach(function (done) {
    Object.keys(requiredEnvVars).forEach(function (key) {
      process.env[key] = requiredEnvVars[key];
    });
    steps.dirs = {};
    steps.dirs.dockerContext = '/tmp/rnnbl.XXXXXXXXXXXXXXXXXXXX';
    steps.dirs.keyDirectory = '/tmp/rnnbl.key.XXXXXXXXXXXXXXXXXXXX';
    steps.logs = {};
    steps.logs.dockerBuild = '/tmp/rnnbl.log.XXXXXXXXXXXXXXXXXXXX';
    steps.logs.stdout = '/tmp/rnnbl.ib.stdout.XXXXXXXXXXXXXXXXXXXX';
    steps.logs.stderr = '/tmp/rnnbl.ib.stderr.XXXXXXXXXXXXXXXXXXXX';
    done();
  });

  lab.beforeEach(function (done) {
    // have to do this to keep the steps.data bit clean between tests
    Object.keys(steps.data).forEach(function (key) {
      delete steps.data[key];
    });
    sinon.stub(childProcess, 'execFile')
      .yieldsAsync(null, new Buffer(''), new Buffer(''));
    // by default, we don't want a layer cache to exist
    childProcess.execFile
      .withArgs('cp')
      .yieldsAsync(new Error('copy failed'));
    sinon.stub(steps, 'saveToLogs', function (cb) {
      return function (err, stdout, stderr) {
        cb(
          err,
          stdout ? stdout.toString() : '', stderr ? stderr.toString() : ''
        );
      };
    });
    sinon.stub(fs, 'readFileSync');
    sinon.stub(fs, 'writeFileSync').returns();
    done();
  });

  lab.afterEach(function (done) {
    childProcess.execFile.restore();
    steps.saveToLogs.restore();
    fs.readFileSync.restore();
    fs.writeFileSync.restore();
    done();
  });

  lab.experiment('succeeds', function () {
    lab.experiment('with runnable-cache', function () {
      lab.beforeEach(function (done) {
        fs.readFileSync.returns([
          'FROM dockerfile/nodejs',
          'EXPOSE 8989',
          'ENV PORT 8989',
          'ENV FON_USER Mr. Man',
          'ADD ./flaming-octo-nemesis /fon',
          'WORKDIR /fon',
          'RUN npm install express # runnable-cache',
          'CMD ["node", "server.js"]'
        ].join('\n'));
        done();
      });

      lab.test('should catch the cache line', function (done) {
        steps.parseDockerfile(function (err) {
          if (err) { return done(err); }
          expect(!!steps.data.usingCache).to.be.false();
          expect(steps.data.cachedLine).to.not.be.undefined();
          expect(steps.data.createdByHash).to.not.be.undefined();
          done();
        });
      });
    });

    lab.experiment('with funky Runnable-cache', function () {
      lab.beforeEach(function (done) {
        fs.readFileSync.returns([
          'FROM dockerfile/nodejs',
          'EXPOSE 8989',
          'ENV PORT 8989',
          'ENV FON_USER Mr. Man',
          'ADD ./flaming-octo-nemesis /fon',
          'WORKDIR /fon',
          'RUN npm install hapi && \\',
          '  npm install express #Runnable-cache',
          'CMD ["node", "server.js"]'
        ].join('\n'));
        done();
      });

      lab.test('should find the cached line', function (done) {
        steps.parseDockerfile(function (err) {
          if (err) { return done(err); }
          sinon.assert.calledOnce(childProcess.execFile);
          expect(!!steps.data.usingCache).to.be.false();
          expect(steps.data.cachedLine).to.not.be.undefined();
          expect(steps.data.createdByHash).to.not.be.undefined();
          done();
        });
      });
    });

    lab.experiment('build dockerfile', function () {
      var testDockerfile = 'i am blue';
      lab.beforeEach(function (done) {
        fs.readFileSync.returns(testDockerfile);
        process.env.RUNNABLE_BUILD_DOCKERFILE = '/dir/Dockerfile';
        process.env.RUNNABLE_REPO = 'git@github.com:Runnable/api';
        done();
      });

      lab.afterEach(function (done) {
        delete process.env.RUNNABLE_BUILD_DOCKERFILE;
        delete process.env.RUNNABLE_REPO;
        done();
      });

      lab.test('should read repo dockerfile', function (done) {
        steps.parseDockerfile(function (err) {
          if (err) { return done(err); }
          var expectedRoot = steps.dirs.dockerContext + '/api';
          expect(steps.dirs.buildRoot).to.equal(expectedRoot);
          sinon.assert.calledOnce(fs.readFileSync);
          sinon.assert.calledWith(fs.readFileSync,
            expectedRoot + '/dir/Dockerfile');

          sinon.assert.calledOnce(fs.writeFileSync);
          sinon.assert.calledWith(fs.writeFileSync,
            expectedRoot + '/dir/Dockerfile', testDockerfile);
          done();
        });
      });

      lab.test('should read cv dockerfile', function (done) {
        delete process.env.RUNNABLE_BUILD_DOCKERFILE;
        steps.parseDockerfile(function (err) {
          if (err) { return done(err); }
          expect(steps.dirs.buildRoot).to.equal(steps.dirs.dockerContext);
          sinon.assert.calledOnce(fs.readFileSync);
          sinon.assert.calledWith(fs.readFileSync,
            steps.dirs.dockerContext + '/Dockerfile');

          sinon.assert.calledOnce(fs.writeFileSync);
          sinon.assert.calledWith(fs.writeFileSync,
            steps.dirs.dockerContext + '/Dockerfile', testDockerfile);
          done();
        });
      });
    });

    lab.experiment('with no runnable-cache', function () {
      lab.beforeEach(function (done) {
        fs.readFileSync.returns([
          'FROM dockerfile/nodejs',
          'EXPOSE 8989',
          'ENV PORT 8989',
          'ENV FON_USER Mr. Man',
          'ADD ./flaming-octo-nemesis /fon',
          'WORKDIR /fon',
          'RUN npm install hapi && \\',
          '  npm install express',
          'CMD ["node", "server.js"]'
        ].join('\n'));
        done();
      });

      lab.test('should not do any caching', function (done) {
        steps.parseDockerfile(function (err) {
          if (err) { return done(err); }
          // not copying a cache
          sinon.assert.notCalled(childProcess.execFile);
          expect(!!steps.data.usingCache).to.be.false();
          expect(steps.data.cachedLine).to.be.undefined();
          expect(steps.data.createdByHash).to.be.undefined();
          done();
        });
      });
    });

    lab.experiment('with an available layer cache', function () {
      lab.beforeEach(function (done) {
        childProcess.execFile
          .withArgs('cp')
          .yieldsAsync(null, new Buffer(''), new Buffer(''));
        fs.readFileSync.returns([
          'FROM dockerfile/nodejs',
          'EXPOSE 8989',
          'ENV PORT 8989',
          'ENV FON_USER Mr. Man',
          'ADD ./flaming-octo-nemesis /fon',
          'WORKDIR /fon',
          'RUN npm install express # runnable-cache',
          'CMD ["node", "server.js"]'
        ].join('\n'));
        done();
      });

      lab.test('should not do any caching', function (done) {
        steps.parseDockerfile(function (err) {
          if (err) { return done(err); }
          expect(!!steps.data.usingCache).to.be.true();
          expect(steps.data.cachedLine).to.not.be.undefined();
          expect(steps.data.createdByHash).to.not.be.undefined();
          // using a cache!
          expect(childProcess.execFile.callCount).to.equal(1);
          done();
        });
      });
    });
  });
});
