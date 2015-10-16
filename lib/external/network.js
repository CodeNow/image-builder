'use strict';

var childProcess = require('child_process');

module.exports = Network;

function Network () {
  if (!process.env.RUNNABLE_CIDR) {
    throw new Error('require cidr');
  }

  if (!process.env.RUNNABLE_HOST_IP) {
    throw new Error('require ip');
  }

  if (!process.env.RUNNABLE_WEAVE_PATH) {
    throw new Error('require weave path');
  }

  this.hostIp =  process.env.RUNNABLE_HOST_IP;
  this.cidr = process.env.RUNNABLE_CIDR;
  this.weavePath = process.env.RUNNABLE_WEAVE_PATH;
}

/**
 * attaches weave ip to container
 * @param  {string}   containerId which needs network attached
 * @param  {Function} cb          (err)
 */
Network.prototype.attach = function(containerId, cb) {
  var cmd = [this.weavePath, 'attach',
    this.hostIp + '/' + this.cidr, containerId].join(' ');
  childProcess.exec(cmd, cb);
};
