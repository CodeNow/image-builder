'use strict';

/* Sauron is used to alloc/dealloc internal ips for containers */
var ApiClient = require('simple-api-client');
var util = require('util');
module.exports = Sauron;

function Sauron (host, port) {
  if (!host) {
    throw new Error('Sauron needs a host');
  }
  this.host = host+':'+port;
  ApiClient.call(this, this.host);
}

util.inherits(Sauron, ApiClient);

/**
 * Attach weave host to the docker container
 * @param  {string}   networkIp  weave networkIp
 * @param  {string}   hostIp      weave hostIp
 * @param  {string}   containerId docker container id
 * @param  {Function} cb          callback
 */
Sauron.prototype.attachHostToContainer =
  function (networkIp, hostIp, containerId, cb) {
    var url = ['networks', networkIp, 'hosts', hostIp, 'actions/attach'];
    this.put(url, {
      json: {
        containerId: containerId
      }
    }, cb);
  };

/**
 * Detach weave  host to the docker container
 * @param  {string}   hostIp      weave hostIp
 * @param  {string}   containerId docker container id
 * @param  {Function} cb          callback
 */
Sauron.prototype.detachHostFromContainer =
  function (networkIp, hostIp, containerId, cb) {
    var url = ['networks', networkIp, 'hosts', hostIp, 'actions/detach'];
    this.put(url, {
      json: {
        containerId: containerId
      }
    }, cb);
};