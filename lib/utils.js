'use strict';

module.exports = {
  log: logUtil.bind(null, 'log'),
  error: logUtil.bind(null, 'error')
};

function logUtil (level /*message...*/) {
  var args = Array.prototype.slice.call(arguments);
  level = args.shift();
  var fn = console[level] || console.log;

  // TODO(bryan): format the args to a json object

  fn.apply(console, args);
}

