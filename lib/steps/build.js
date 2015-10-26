'use strict';

require('colors');
var tar = require('tar-fs');
var fs = require('fs');
var assign = require('101/assign');
var utils = require('../utils');
var noop = require('101/noop');

module.exports = Builder;

function Builder (steps) {
  this.dockerContext = steps.dirs.dockerContext;
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
  var extraFlags = JSON.parse(process.env.RUNNABLE_BUILD_FLAGS || '{}');
  assign(opts, extraFlags);

  self.docker.buildImage(tarStream, opts, function (err, response) {
    if (err) { return cb(err); }
    self._handleBuild(response, cb);
  });
};

/**
 * should create a tar stream for dockerContext
 * @return {object} tarStream
 */
Builder.prototype._getTarStream = function () {
  return tar.pack(this.dockerContext);
};

/**
 * add handlers to build stream
 * @param  {object}   response steam to attach handlers too
 * @param  {Function} cb       (err)
 */
Builder.prototype._handleBuild = function (response, cb) {
  var self = this;

  this.docker.modem.followProgress(response, onFinished, onProgress);

  function onFinished (message) {
    // this message is a string, thanks to `followProgress`
    // success is still null, if message -> error
    var err;
    if (message) {
      err = new Error(message);
    }
    self.saveToLogs(cb)(err, '', message);
  }

  function onProgress (data) {
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
