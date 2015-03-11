'use strict';
var docker = require('../external/docker.js');

module.exports = Sauron;

function Sauron (host, port) {
  if (!host || !port) {
    throw new Error('Sauron needs a host and a port');
  }
  this.host = host+':'+port;
}

// should send sigint to container
 Sauron.prototype.attachHostToContainer =
  function (networkIp, hostIp, containerId, cb) {
    // hook to get sauron to fail
    if (process.env.SAURON_FAIL) {
      return cb(null, {statusCode: 500});
    }
    // i will be shunned for this, but need to wait before calling sigint
    // the time when we get the message to time code runs is different
    // but no other way due to limited message passing and its only a test
    setTimeout(function(){
      docker.getContainer(containerId).kill({
        signal: 'SIGINT'
      }, function(err) {
        cb(err, {statusCode: 200});
      });
    }, 1000);
};

// noop
Sauron.prototype.detachHostFromContainer =
  function (networkIp, hostIp, containerId, cb) {
  cb(null, {statusCode: 200});
};