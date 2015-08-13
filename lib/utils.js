'use strict';

module.exports = {
  log: logUtil.bind(null, 'log'),
  progress: logUtil.bind(null, 'progress'),
  error: logUtil.bind(null, 'error')
};

function logUtil (level /*message...*/) {
  var args = Array.prototype.slice.call(arguments);
  level = args.shift();
  var fn = console[level] || console.log;
  var content = '';
  if (args.length > 1) {
    // assume string messages to join
    content = args.join(' ');
  } else if (args.length) {
    // there's only one
    content = args[0];
  }

  var data = {
    type: level,
    content: content
  };

  fn.apply(console, [JSON.stringify(data)]);
}

