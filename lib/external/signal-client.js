'use strict';

module.exports = Signal;

function Signal (host, port) {
  if (!host || !port) {
    throw new Error('Signal needs a host and a port');
  }
  this.host = host+':'+port;
}

// should send sigint to container
Signal.prototype.attachHostToContainer =
  function (networkIp, hostIp, opts, cb) {
    var containerId = opts.containerId;
    // hook to get sauron to fail
    if (process.env.SAURON_FAIL) {
      return cb(null, { statusCode: 500 });
    }
    // i will be shunned for this, but need to wait before calling sigint
    // the time when we get the message to time code runs is different
    // but no other way due to limited message passing and its only a test
    var docker = require('../external/docker.js')();
    setTimeout(function () {
      docker.getContainer(containerId).kill({
        signal: 'SIGINT'
      }, function (err) {
        cb(err, { statusCode: 200 });
      });
    }, 1000);
 };
