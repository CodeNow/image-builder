'use strict';
var tar = require('tar-fs');
var fs = require('fs');

var docker = require('../external/docker.js');
var network;
// we only need network if we are using weave
if (process.env.RUNNABLE_WAIT_FOR_WEAVE) {
  network = require('../external/network.js');
}

var noop = function(){};

module.exports = function runDockerBuild (steps, cb) {
  if (!process.env.RUNNABLE_DOCKERTAG) {
    return cb(new Error('RUNNABLE_DOCKERTAG is missing.'));
  }
  if (!process.env.RUNNABLE_DOCKER_BUILDOPTIONS) {
    process.env.RUNNABLE_DOCKER_BUILDOPTIONS = '';
  }

  console.log('Building server...'.bold.yellow);
  var tarPath = steps.dirs.dockerContext+'.tar';
  tar
    .pack(steps.dirs.dockerContext)
    .pipe(fs.createWriteStream(tarPath))
    .on('finish', function() {
      docker.buildImage(tarPath, {
        t: process.env.RUNNABLE_DOCKERTAG
      }, function (err, response) {
        if (err) { return cb(err); }

        var buildErr = null;
        var needAttach = null;
        response.on('data', function(data) {
          data = JSON.parse(data);
          fs.appendFileSync(steps.logs.dockerBuild, data.error || data.stream);
          steps.saveToLogs(noop)(null, data.stream || '', data.error || '');
          var out = data.stream;

          // TODO: make this a robust state machine
          // we only need to be stateful for one event no need to do it now
          if (data.error) {
            buildErr = data.error;
            out = data.error;
          } else if (needAttach) {
            needAttach = false;
            var containerId = data
              .stream
              .split('Running in ')[1]
              .replace('\n','')
              .trim();

            network.attach(containerId, function(err) {
              // something went wrong, kill container to stop the build
              if (err) {
                process.stderr.write('error attaching to runnable network \n');
                process.stderr.write('please rebuild');
                docker.getContainer(containerId).kill(function() {
                  process.exit(1);
                });
              }
            });
          } else if (
            ~data.stream.indexOf(process.env.RUNNABLE_WAIT_FOR_WEAVE)) {
              out =
                data.stream.replace(process.env.RUNNABLE_WAIT_FOR_WEAVE, '');
              needAttach = true;
          }

          process.stdout.write(out);
        });
        response.on('end', function() {
          cb(buildErr);
        });
      });
    });
};