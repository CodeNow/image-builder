'use strict';

require('colors');
var tar = require('tar-fs');
var fs = require('fs');
var Network = require('../external/network.js');

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

Builder.prototype.runDockerBuild = function (cb) {
  var self = this;
  self.tarContext(function (err) {
    if (err) { return cb(err); }

    self.startImageBuild(cb);
  });
};

Builder.prototype.tarContext = function (cb) {
  this.tarPath = this.dockerContext + '.tar';
  tar
    .pack(this.dockerContext)
    .pipe(fs.createWriteStream(this.tarPath))
    .on('finish', cb);
};

Builder.prototype.startImageBuild = function (cb) {
  var self = this;
  this.docker.buildImage(self.tarPath, {
    t: process.env.RUNNABLE_DOCKERTAG
  }, function (err, response) {
    if (err) { return cb(err); }
    self.handleBuild(response, cb);
  });
};

Builder.prototype.handleBuild = function (response, cb) {
  var self = this;

  response.on('error', cb);
  response.on('data', function (data) {
    self.handleBuildData(data);
  });
  response.on('end', function () {
    cb(self.buildErr);
  });
};

Builder.prototype.handleBuildData = function (data) {
  var self = this;

  data = JSON.parse(data);
  var out = data.stream || '';
  fs.appendFileSync(self.dockerBuildLog, data.error || out);
  self.saveToLogs(noop)(null, out, data.error || '');

  // TODO: make this a robust state machine
  // we only need to be stateful for one event no need to do it now
  if (data.error) {
    self.buildErr = data.error;
    out = data.error;
  } else if (this.needAttach) {
    this.needAttach = false;
    self.handleNetworkAttach(out);
  } else if (isWaitForWeaveLine(out)) {
    this.needAttach = true;
    out = out.replace(process.env.RUNNABLE_WAIT_FOR_WEAVE, '');
  }

  process.stdout.write(out);
};

function isWaitForWeaveLine (line) {
  return ~line.indexOf(process.env.RUNNABLE_WAIT_FOR_WEAVE);
}

Builder.prototype.handleNetworkAttach = function (line) {
  var self = this;
  // ignore if not Running In aka cache line
  if (!~line.indexOf('Running in ')) { return; }

  var containerId = line
    .split('Running in ')[1]
    .replace('\n','')
    .trim();

  self.network.attach(containerId, self.postNetworkAttach(containerId));
};

Builder.prototype.postNetworkAttach = function (containerId) {
  var self = this;
  return function (err) {
    // something went wrong, kill container to stop the build
    if (err) {
      process.stderr.write('error attaching to runnable network \n');
      process.stderr.write('please rebuild');
      self.docker.getContainer(containerId).kill(function () {
        process.exit(1);
      });
    }
  };
};
