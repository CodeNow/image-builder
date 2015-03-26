'use strict';

var Docker = require('dockerode');
var url = require('url');

module.exports = docker;

function docker () {
  if (!process.env.RUNNABLE_DOCKER) {
    throw new Error('RUNNABLE_DOCKER required');
  }
  var uri = url.parse(process.env.RUNNABLE_DOCKER);

  var dockerHost = {};
  if (uri.protocol === 'unix:' && uri.slashes) {
    // format: unix:///var/run/docker.sock
    dockerHost.socketPath = uri.path;
  } else {
    // format: tcp://10.234.129.94:5354
    if (uri.port && uri.hostname) {
      dockerHost.host = uri.hostname;
      dockerHost.port = uri.port;
    }
  }

  if (Object.keys(dockerHost).length === 0) {
    throw new Error('dockerhost not set');
  }

  return new Docker(dockerHost);
}
