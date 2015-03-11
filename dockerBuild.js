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
    if (err) {
      console.error(
        colors.red.bold('Hit an unexpected error: %s'), err.message);
      process.exit(1);
    }
    console.log('Build completed successfully!'.bold.green);
  }
);
