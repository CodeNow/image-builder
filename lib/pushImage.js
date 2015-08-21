'use strict';

// first check for required env's
if (!process.env.RUNNABLE_DOCKERTAG) {
  console.error('Missing RUNNABLE_DOCKERTAG can not push');
  return process.exit(128);
}
if (!process.env.RUNNABLE_DOCKER) {
  console.error('Missing RUNNABLE_DOCKER can not push');
  return process.exit(128);
}

var ImageDelivery = require('./steps/image-delivery.js');
var imageDelivery  = new ImageDelivery();

// push image
imageDelivery.pushImage(process.env.RUNNABLE_DOCKERTAG, function (err) {
  if (err) {
    console.error('push failed', err);
    // must exit with non-zero exit code to retry
    return process.exit(1);
  }
  // ensure clean exist on success
  process.exit(0);
});
