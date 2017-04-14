'use strict';

require('colors');
var assign = require('101/assign');
var escapeRegExp = require('escape-regex-string');
var fs = require('fs');
var noop = require('101/noop');
var tar = require('tar-fs');
var path = require('path');

var utils = require('../utils');

module.exports = Builder;

function Builder (steps) {
  this.repoRoot = steps.dirs.repoRoot;
  this.buildRoot = steps.dirs.buildRoot;
  this.dockerfileName = steps.dockerfileName;
  this.dockerfilePath = steps.runnableBuildDockerfile;
  this.dockerBuildLog = steps.logs.dockerBuild;
  this.saveToLogs = steps.saveToLogs;
  this.dockerContext = steps.dirs.dockerContext;

  if (process.env.RUNNABLE_DOCKER) {
    this.docker = require('../external/docker.js')();
  }
}

/**
 * main entry point
 * send build command with tar context to docker daemon
 * @param  {Function} cb (err)
 */
Builder.prototype.runDockerBuild = function (cb) {
  var self = this;
  var tarStream = self._getTarStream();
  var opts = {
    t: process.env.RUNNABLE_DOCKERTAG
  };
  utils.log('Set build context: ' + opts.context);

  // If there is a file docker.runnable we should
  // pull it and parse it for the registry
  var configFile = path.join(this.dockerContext, 'runnable.json');
  var registryConf = {};
  var rawContents = null;
  // We want to catch any possible file read errors
  try {
    rawContents = fs.readFileSync(configFile, { encoding: 'utf-8' });
  } catch (err) {
    if (err.code !== 'ENOENT') {
      utils.log('We had issues reading runnable.json: ' + err.message);
    }
  }

  if (rawContents) {
    try {
      registryConf = JSON.parse(rawContents);
    } catch (e) {
      utils.log('runnable.json is not valid JSON');
    }
  }


  if (typeof registryConf === 'object' &&
    registryConf.url &&
    registryConf.username &&
    registryConf.password
  ) {
    // Registry config documentation:
    // https://docs.docker.com/engine/reference/api/docker_remote_api_v1.22/#build-image-from-a-dockerfile
    opts.registryconfig = {};
    opts.registryconfig[registryConf.url] = {
      username: registryConf.username,
      password: registryConf.password
    };
    utils.log('Logging into ' + registryConf.url +
      ' as ' + registryConf.username);
  }

  // https://docs.docker.com/engine/reference/api/docker_remote_api_v1.22/#/build-image-from-a-dockerfile
  // Path within the build context to the Dockerfile.
  // By default we just generate 'Dockerfile'
  // opts.dockerfile = this.dockerfileName;

  // if build context specified use full path to the dockerfile
  // otherwise use dockerfilename
  var runBuildContext = process.env.RUNNABLE_BUILD_DOCKER_CONTEXT;
  if (runBuildContext) {
    utils.log('Runnable build context: ' + runBuildContext);
    utils.log('Index of:' + this.dockerfilePath.indexOf(runBuildContext));
    if (this.dockerfilePath.indexOf(runBuildContext) === 1) {
      opts.dockerfile = path.relative(runBuildContext, this.dockerfilePath);
    } else {
      opts.dockerfile = this.dockerfilePath;
    }
  } else {
    opts.dockerfile = this.dockerfileName;
  }

  utils.log('Set dockefile: ' + opts.dockerfile);
  utils.log('Docker original context:' + this.dockerContext);
  var extraFlags = JSON.parse(process.env.RUNNABLE_BUILD_FLAGS || '{}');
  assign(opts, extraFlags);
  utils.log('Set docker opts: ' + JSON.stringify(opts));
  self.docker.buildImage(tarStream, opts, function (err, response) {
    if (err) { return cb(err); }
    self._handleBuild(response, cb);
  });
};

/**
 * should create a tar stream for buildRoot
 * @return {object} tarStream
 */
Builder.prototype._getTarStream = function () {
  var buildRoot = process.env.RUNNABLE_BUILD_DOCKER_CONTEXT ?
    path.resolve(this.repoRoot, process.env.RUNNABLE_BUILD_DOCKER_CONTEXT)
    : this.buildRoot;
  utils.log('Tar build root: ' + buildRoot);
  return tar.pack(buildRoot);
};

/**
 * add handlers to build stream
 * @param  {object}   response steam to attach handlers too
 * @param  {Function} cb       (err)
 */
Builder.prototype._handleBuild = function (response, cb) {
  var self = this;
  var timout;
  this.docker.modem.followProgress(response, onFinished, onProgress);

  function onFinished (message) {
    clearTimeout(timout);
    // this message is a string, thanks to `followProgress`
    // success is still null, if message -> error
    var err;
    if (message) {
      err = new Error(message);
    }
    self.saveToLogs(cb)(err, '', message);
  }

  function timeoutBuild () {
    response.removeAllListeners();
    onFinished('build timeout');
  }

  function onProgress (data) {
    if (process.env.RUNNABLE_BUILD_LINE_TIMEOUT_MS) {
      clearTimeout(timout);
      timout = setTimeout(timeoutBuild,
        process.env.RUNNABLE_BUILD_LINE_TIMEOUT_MS);
    }
    self._handleBuildData(data);
  }
};

/**
 * performs actions based on data coming from build stream
 * @param  {string} data string from build stream
 */
Builder.prototype._handleBuildData = function (data) {
  if (data.stream) {
    var out = data.stream;
    fs.appendFileSync(this.dockerBuildLog, data.error || out);
    this.saveToLogs(noop)(null, out, '');

    if (isWaitForWeaveLine(out)) {
      out = out.replace(process.env.RUNNABLE_WAIT_FOR_WEAVE, '');
    }

    if (shouldLog(out)) {
      utils.dockerLog(out);
    }
  } else { // it's progress
    utils.progress(data);
  }
};

/**
 * checks to see if we should print this line
 * should hold a blacklist of lines we do not want to be printed to users
 * @param  {string} line check to see if we should log
 * @return {boolean}     true if we should log line, else false
 */
function shouldLog (line) {
  return ! /Removing intermediate container/.test(line);
}

/**
 * checks to see if line is a RUN wait for weave line
 * @param  {string}  line dockerfile line
 * @return {Boolean}      [description]
 */
function isWaitForWeaveLine (line) {
  // output formated like so
  // Step 7 : RUN waitForWeave
  if (!process.env.RUNNABLE_WAIT_FOR_WEAVE) { return false; }
  var regExp = '[ \t]*RUN ' + escapeRegExp(process.env.RUNNABLE_WAIT_FOR_WEAVE);
  var runRegExp = new RegExp(regExp, 'i');
  return runRegExp.test(line);
}
