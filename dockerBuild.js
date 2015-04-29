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
    var msgPrefix = '[Runnable (image-builder)]';
    if (err) {
      var message = err.message ? err.message : 'unknown';
      console.error(
        colors.red.bold(msgPrefix + ' Hit an unexpected error: %s'), message);
      process.exit(1);
    }
    console.log(msgPrefix + ' Build completed successfully!'.bold.green);
  }
);
