'use strict';
var tar = require('tar-fs');
var fs = require('fs');

var noop = function(){};

module.exports = Builder;

function Builder (steps) {
  this.dockerContext = steps.dirs.dockerContext;
  this.dockerBuildLog = steps.logs.dockerBuild;
  this.saveToLogs = steps.saveToLogs;

  if (process.env.RUNNABLE_DOCKER !== 'undefined') {
    this.docker = require('../external/docker.js');
  }
  // we only need network if we are using weave
  if (process.env.RUNNABLE_WAIT_FOR_WEAVE !== 'undefined') {
    this.network = require('../external/network.js');
  }
}

Builder.prototype.runDockerBuild = function (cb) {
  var self = this;
  console.log('Building server...'.bold.yellow);
  self.tarContext(function() {
    self.startImageBuild(cb);
  });
};

Builder.prototype.tarContext = function (cb) {
  this.tarPath = this.dockerContext+'.tar';
  tar
    .pack(this.dockerContext)
    .pipe(fs.createWriteStream(this.tarPath))
    .on('finish', cb);
};

Builder.prototype.startImageBuild = function (cb) {
  var self = this;

  self.docker.buildImage(self.tarPath, {
    t: process.env.RUNNABLE_DOCKERTAG
  }, function(err, response) {
    if (err) { return cb(err); }

    self.handleBuild(response, cb);
  });
};

Builder.prototype.handleBuild = function (response, cb) {
  var self = this;

  response.on('data', function(data) {
    self.handleBuildData(data);
  });
  response.on('end', function() {
    cb(self.buildErr);
  });
};

Builder.prototype.handleBuildData = function (data) {
  var self = this;

  data = JSON.parse(data);
  fs.appendFileSync(self.dockerBuildLog, data.error || data.stream);
  self.saveToLogs(noop)(null, data.stream || '', data.error || '');
  var out = data.stream;

  // TODO: make this a robust state machine
  // we only need to be stateful for one event no need to do it now
  if (data.error) {
    self.buildErr = data.error;
    out = data.error;
  } else if (this.needAttach) {
    this.needAttach = false;
    self.handleNetworkAttach(data);
  } else if (isWaitForWeaveLine(data)) {
    this.needAttach = true;
    out = data.stream.replace(process.env.RUNNABLE_WAIT_FOR_WEAVE, '');
  }

  process.stdout.write(out);
};

function isWaitForWeaveLine (data) {
  return ~data.stream.indexOf(process.env.RUNNABLE_WAIT_FOR_WEAVE);
}

Builder.prototype.handleNetworkAttach = function (data) {
  var self = this;
  // ignore if not Running In aka cache line
  if (!~data.stream.indexOf('Running in ')) { return; }

  var containerId = data.stream
    .split('Running in ')[1]
    .replace('\n','')
    .trim();

  self.network.attach(containerId,
    self.postNetworkAttach(containerId));
};

Builder.prototype.postNetworkAttach = function (containerId) {
  var self = this;
  return function (err) {
    // something went wrong, kill container to stop the build
    if (err) {
      process.stderr.write('error attaching to runnable network \n');
      process.stderr.write('please rebuild');
      self.docker.getContainer(containerId).kill(function() {
        process.exit(1);
      });
    }
  };
};