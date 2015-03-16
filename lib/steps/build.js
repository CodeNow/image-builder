'use strict';
var tar = require('tar-fs');
var fs = require('fs');

var docker = require('../external/docker.js');
var network;
// we only need network if we are using weave
if (process.env.RUNNABLE_WAIT_FOR_WEAVE) {
  network = require('../external/network.js');
}

var noop = function(){};

module.exports = Builder;

function Builder () {}

Builder.prototype.runDockerBuild = function (steps, cb) {
  var self = this;
  console.log('Building server...'.bold.yellow);
  self.tarContext(steps, self.buildImage(steps, cb));
};

Builder.prototype.tarContext = function (steps, cb) {
  steps.tarPath = steps.dirs.dockerContext+'.tar';
  tar
    .pack(steps.dirs.dockerContext)
    .pipe(fs.createWriteStream(steps.tarPath))
    .on('finish', cb);
};

Builder.prototype.buildImage = function (steps, cb) {
  var self = this;
  return function() {
    docker.buildImage(steps.tarPath, {
      t: process.env.RUNNABLE_DOCKERTAG
    }, self.handleBuild(steps, cb));
  };
};

Builder.prototype.handleBuild = function (steps, cb) {
  var self = this;
  return function (err, response) {
    if (err) { return cb(err); }

    response.on('data', self.handleBuildData(steps));
    response.on('end', cb.bind(self, steps.buildErr));
  };
};

Builder.prototype.handleBuildData = function (steps) {
  var needAttach = false;
  var self = this;

  return function(data) {
    data = JSON.parse(data);
    fs.appendFileSync(steps.logs.dockerBuild, data.error || data.stream);
    steps.saveToLogs(noop)(null, data.stream || '', data.error || '');
    var out = data.stream;

    // TODO: make this a robust state machine
    // we only need to be stateful for one event no need to do it now
    if (data.error) {
      steps.buildErr = data.error;
      out = data.error;
    } else if (needAttach) {
      needAttach = false;
      self.handleNetworkAttach(data);
    } else if (self.isWaitForWeaveLine(data)) {
      needAttach = true;
      out = data.stream.replace(process.env.RUNNABLE_WAIT_FOR_WEAVE, '');
    }

    process.stdout.write(out);
  };
};

Builder.prototype.isWaitForWeaveLine = function (data) {
  return ~data.stream.indexOf(process.env.RUNNABLE_WAIT_FOR_WEAVE);
};

Builder.prototype.handleNetworkAttach = function (data) {
  var self = this;
  // ignore if cache
  if (!~data.stream.indexOf('Running in ')) { return; }

  var containerId = data.stream
    .split('Running in ')[1]
    .replace('\n','')
    .trim();

  network.attach(containerId, self.postNetworkAttach);
};

Builder.prototype.postNetworkAttach = function (containerId) {
  return function (err) {
    // something went wrong, kill container to stop the build
    if (err) {
      process.stderr.write('error attaching to runnable network \n');
      process.stderr.write('please rebuild');
      docker.getContainer(containerId).kill(function() {
        process.exit(1);
      });
    }
  };
};