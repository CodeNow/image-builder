'use strict';

var isString = require('101/is-string');
var version = require('../package.json').version;

module.exports = {
  dockerLog: logUtil.bind(null, 'docker'),
  log: logUtil.bind(null, 'log'),
  progress: logUtil.bind(null, 'progress'),
  heartbeat: logUtil.bind(null, 'heartbeat'),
  error: logUtil.bind(null, 'error')
};

function logUtil (level /*message...*/) {
  var args = Array.prototype.slice.call(arguments);
  level = args.shift();
  var fn = console[level] || console.log;
  var content = '';
  var postFix = level === 'docker' ? '' : '\r\n';
  if (args.length > 1) {
    // assume string messages to join
    content = args.join(' ');
    // append \r\n to imagebuilder output
    content += postFix;
  } else if (args.length && isString(args[0])) {
    // there's only one
    content = args[0];
    // append \r\n to imagebuilder output
    content += postFix;
  } else if (args.length) {
    content = args[0];
    // don't append \r\n because it's not a string
  }
  if (level === 'heartbeat') {
    content = { version: version };
  }

  var data = {
    type: level,
    content: content,
    timestamp: new Date()
  };

  fn.apply(console, [JSON.stringify(data)]);
}

