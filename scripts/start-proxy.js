'use strict';

var httpProxy = require('http-proxy');
var http = require('http');

var proxy = new httpProxy.createProxyServer();

var proxyServer = http.createServer(function (req, res) {
  if (/\/images\/.*\/push/.test(req.url)) {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ 'stream': 'Successfully pushed' }));
  }
  proxy.web(req, res, {
    target: {
      socketPath: '/var/run/docker.sock'
    }
  });
});

proxyServer.on('upgrade', function (req, socket, head) {
  proxy.ws(req, socket, head, {
    target: {
      socketPath: '/var/run/docker.sock'
    }
  });
});

proxyServer.listen(5354);
