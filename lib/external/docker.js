'use strict';

var Docker = require('dockerode');

module.exports = docker;

function docker () {
  var dockerHost = {};
  if (process.env.RUNNABLE_DOCKER) {
    if (~process.env.RUNNABLE_DOCKER.indexOf('unix://')) {
      // format: unix:///var/run/docker.sock
      dockerHost.socketPath = 
        process.env.RUNNABLE_DOCKER.replace('unix://', '');
    } else {
      // format: tcp://10.234.129.94:5354
      var match = /^(\w+:\/\/)?([^:\/]+):?(\d+)?$/
        .exec(process.env.RUNNABLE_DOCKER);
      if (match) {
        dockerHost.host = match[2];
        dockerHost.port = match[3];
      }
    }
  }
  return new Docker(dockerHost);
}
