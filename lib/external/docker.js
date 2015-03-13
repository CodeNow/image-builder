var Docker = require('dockerode');

var dockerHost = {};

if (~process.env.RUNNABLE_DOCKER.indexOf('unix://')) {
  // format: unix:///var/run/docker.sock
  dockerHost.socketPath = process.env.RUNNABLE_DOCKER.replace('unix://', '');
} else if (process.env.RUNNABLE_DOCKER.split(':').length === 2) {
  // format: 10.234.129.94:5354
  dockerHost.host = process.env.RUNNABLE_DOCKER.split(':')[0];
  dockerHost.port = process.env.RUNNABLE_DOCKER.split(':')[1];
}

module.exports = new Docker(dockerHost);
