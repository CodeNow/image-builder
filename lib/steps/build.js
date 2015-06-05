'use strict';

require('colors');
var tar = require('tar-fs');
var fs = require('fs');
var Network = require('../external/network.js');
var assign = require('101/assign');
var escapeRegExp = require('escape-regex-string');
var noop = function () {};

module.exports = Builder;

function Builder (steps) {
  this.dockerContext = steps.dirs.dockerContext;
  this.dockerBuildLog = steps.logs.dockerBuild;
  this.saveToLogs = steps.saveToLogs;

  if (process.env.RUNNABLE_DOCKER) {
    this.docker = require('../external/docker.js')();
  }
  // we only need network if we are using weave
  if (process.env.RUNNABLE_WAIT_FOR_WEAVE) {
    this.network = new Network();
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

  response.on('error', cb);
  response.on('data', function (data) {
    self._handleBuildData(data);
  });
  response.on('end', function () {
    cb(self.buildErr);
  });
};

/**
 * performs actions based on data coming from build stream
 * @param  {string} data string from build stream
 */
Builder.prototype._handleBuildData = function (data) {
  var self = this;

  data = JSON.parse(data);
  var out = data.stream || '';
  fs.appendFileSync(self.dockerBuildLog, data.error || out);
  self.saveToLogs(noop)(null, out, data.error || '');

  // TODO: make this a robust state machine
  // we only need to be stateful for one event no need to do it now
  if (data.error) {
    // do not print errors
    // build error message should only include return code
    var returnedText = /returned.*/.exec(data.error);
    returnedText = returnedText ? returnedText[0] : 'returned an error' ;
    self.buildErr = {
      customMessage: 'previous line ' + returnedText
    };

  } else if (this.needAttach) {
    this.needAttach = false;
    self._handleNetworkAttach(out);
  } else if (isWaitForWeaveLine(out)) {
    this.needAttach = true;
    out = out.replace(process.env.RUNNABLE_WAIT_FOR_WEAVE, '');
  }

  process.stdout.write(out);
};

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

/**
 * should attach network to container specified in line
 * @param  {string} line run line container container id
 */
Builder.prototype._handleNetworkAttach = function (line) {
  var self = this;
  // ignore if not Running In aka cache line
  if (!~line.indexOf('Running in ')) { return; }

  var containerId = line
    .split('Running in ')[1]
    .replace('\n','')
    .trim();

  self.network.attach(containerId, self._postNetworkAttach(containerId));
};

/**
 * handle network attach errors
 * @param  {string} containerId current running container id
 */
Builder.prototype._postNetworkAttach = function (containerId) {
  var self = this;
  return function (err, res) {
    // something went wrong, kill container to stop the build
    if (err || (res && res.statusCode === 500)) {
      process.stderr.write(
        'Runnable: error attaching to runnable network\n');
      self.docker.getContainer(containerId).kill(function () {
        process.exit(1);
      });
    }
  };
};
