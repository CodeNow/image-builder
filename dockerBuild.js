#!/usr/bin/env node
'use strict';

var colors = require('colors');
var async = require('async');
var steps = require('./lib/steps');
var utils = require('./lib/utils');

function printTimestamp () {
  utils.heartbeat();
}
var interval;

async.series([
    function (cb) {
      printTimestamp();
      interval = setInterval(printTimestamp, 15*1000);
      cb();
    },
    steps.checkForRequiredEnvVars,
    steps.makeWorkingFolders,
    steps.downloadDeployKeys,
    steps.chmodAllKeys,
    steps.downloadBuildFiles,
    steps.getRepositories,
    steps.applySearchAndReplace,
    steps.parseDockerfile,
    steps.runDockerBuild,
    steps.parseBuildLogAndHistory,
    steps.copyLayer,
    steps.pushImage
  ],
  function (err) {
    var msgPrefix = 'Runnable: ';
    if (err) {
      if (err.message === 'build timeout') {
        utils.error(colors.red.bold(msgPrefix + err.message));
        return process.exit(124);
      }

      if (!err.noLog) {
       var message = 'Hit an unexpected error: ' +
          err.message ? err.message : 'unknown';
        utils.error(colors.red.bold(msgPrefix + message));
      }
      process.exit(1);
    }
    clearInterval(interval);
    utils.log(
      colors.green.bold(msgPrefix + 'Build completed successfully!'));
  }
);
