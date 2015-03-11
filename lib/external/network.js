'use strict';

var conire = require('conire');
var Sauron = conire(process.env.RUNNABLE_NETWORK_DRIVER, {
  test: './sauron-test.js',
  sauron: './sauron-client.js'
});

var sauron = new Sauron(
  process.env.RUNNABLE_SAURON_HOST.split(':')[0],
  process.env.RUNNABLE_SAURON_HOST.split(':')[1]);

module.exports = {
  // attach network to current container
  attach: function(containerId, cb) {
    var networkIp =  process.env.RUNNABLE_NETWORK_IP;
    var hostIp =  process.env.RUNNABLE_HOST_IP;
    // TODO: emit this as an event
    // "containerId" needs network
    // message will include hostIp and containerId and dockIp

    // needs to be super robust, we know build containers are always changing
    // we always detach before attaching to ensure attachment
    retryOnError(sauron
      .detachHostFromContainer
      .bind(sauron, networkIp, hostIp, containerId), function (err, res) {
      if (err) { return cb(err); }

      var oldContainer = res.body.oldContainer;

      retryOnError(sauron
        .detachHostFromContainer
        .bind(sauron, networkIp, hostIp, oldContainer), doAttach);
    });

    function doAttach(err) {
      if (err) { return cb(err); }
      retryOnError(sauron
        .attachHostToContainer
        .bind(sauron, networkIp, hostIp, containerId), cb);
    }

  }
};

function retryOnError(func, cb) {
  var retryCount = 5;
  retry();
  function retry (err) {
    retryCount--;
    if (retryCount <= 0) {
      return cb(err);
    }
    func(function(err, res) {
      if (err || res.statusCode >= 500) {
        return setTimeout(retry.bind(null, err || res.statusCode), 1000);
      }
      cb(null, res);
    });
  }
}
