'use strict';

var conire = require('conire');

module.exports = Network;

function Network () {
  if (!process.env.RUNNABLE_SAURON_HOST) {
    throw new Error('require sauronHost');
  }
  if (!process.env.RUNNABLE_NETWORK_IP) {
    throw new Error('require networkIp');
  }
  if (!process.env.RUNNABLE_HOST_IP) {
    throw new Error('require hostIp');
  }
  if (!process.env.RUNNABLE_NETWORK_DRIVER) {
    throw new Error('require driver');
  }

  this.networkIp =  process.env.RUNNABLE_NETWORK_IP;
  this.hostIp =  process.env.RUNNABLE_HOST_IP;

  var Driver = conire(process.env.RUNNABLE_NETWORK_DRIVER, {
    signal: './signal-client.js',
    sauron: 'sauron-client'
  });

  this.driver = new Driver(
    process.env.RUNNABLE_SAURON_HOST.split(':')[0],
    process.env.RUNNABLE_SAURON_HOST.split(':')[1]);
}

// TODO: emit this as an event
// "containerId" needs network
// message will include hostIp and containerId and dockIp
Network.prototype.attach = function(containerId, cb) {
  // needs to be super robust, retry a few times, and force attach
  var retryCount = 5;
  var self = this;
  retry();
  function retry (err) {
    retryCount--;
    if (retryCount < 0) {
      return cb(err);
    }

    self.driver.attachHostToContainer(self.networkIp, self.hostIp, {
      containerId: containerId,
      force: true
    }, function(err, res) {
      if (err) {
        return setTimeout(retry.bind(self, err), 1000);
      }

      cb(null, res);
    });
  }
};
