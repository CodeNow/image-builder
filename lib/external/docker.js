var Docker = require('dockerode');

// format: 10.234.129.94:5354
var dockerHost = process.env.RUNNABLE_DOCKER.split(':')[0];
var dockerPort = process.env.RUNNABLE_DOCKER.split(':')[1];

module.exports = new Docker({
  host: dockerHost,
  port: dockerPort
});