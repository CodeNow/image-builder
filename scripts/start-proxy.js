var httpProxy = require('http-proxy');

httpProxy.createProxyServer({
  target: {
    socketPath: '/var/run/docker.sock'
  }
}).listen(5354);
