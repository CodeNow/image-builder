'use strict';

var Docker = require('dockerode');
var url = require('url');

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
      var parsed = url.parse(process.env.RUNNABLE_DOCKER);
      dockerHost.host = parsed.hostname;
      dockerHost.port = parsed.port;
    }
  }
  return new Docker(dockerHost);
}
