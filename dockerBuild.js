#!/usr/bin/env node
'use strict';

var colors = require('colors');
var async = require('async');
var steps = require('./lib/steps');

async.series([
    steps.checkForRequiredEnvVars,
    steps.makeWorkingFolders,
    steps.downloadDeployKeys,
    steps.chmodAllKeys,
    steps.downloadBuildFiles,
    steps.getRepositories,
    steps.parseDockerfile,
    steps.runDockerBuild,
    steps.parseBuildLogAndHistory,
    steps.copyLayer
  ],
  function (err) {
    var msgPrefix = 'Runnable: ';
    if (err) {
      if (!err.noLog) {
       var message = 'Hit an unexpected error: ' +
          err.message ? err.message : 'unknown';
        console.error(colors.red.bold(msgPrefix + message));
      }
      process.exit(1);
    }
    console.log(
      colors.green.bold(msgPrefix + ' Build completed successfully!'));
  }
);
