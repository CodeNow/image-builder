'use strict';

require('colors');
var assign = require('101/assign');
var escapeRegExp = require('escape-regex-string');
var fs = require('fs');
var noop = require('101/noop');
var path = require('path');
var tar = require('tar-fs');

var utils = require('../utils');

module.exports = Builder;

function Builder (steps) {
  this.buildRoot = steps.dirs.buildRoot;
  this.dockerBuildLog = steps.logs.dockerBuild;
  this.saveToLogs = steps.saveToLogs;

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

  if (process.env.RUNNABLE_BUILD_ROOT) {
    opts.dockerfile = path.join(process.env.RUNNABLE_BUILD_ROOT, 'Dockerfile')
  }

  var extraFlags = JSON.parse(process.env.RUNNABLE_BUILD_FLAGS || '{}');
  assign(opts, extraFlags);

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
  return tar.pack(this.buildRoot);
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
