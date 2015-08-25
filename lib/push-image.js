'use strict';
// first check for required env's
var hasEnvs = ['RUNNABLE_DOCKERTAG', 'RUNNABLE_DOCKER'].every(
  function (element) {
    if (!process.env[element]) {
      console.error('Missing ' + element +' can not push');
      return false;
    }
    return true;
});

if (!hasEnvs) {
  process.exit(128);
} else {
  var ImageDelivery = require('./steps/image-delivery.js');
  var imageDelivery  = new ImageDelivery();

  imageDelivery.pushImage(process.env.RUNNABLE_DOCKERTAG, function (err) {
    if (err) {
      console.error('push failed', err);
      // must exit with non-zero exit code to retry
      process.exit(1);
    } else {
      // ensure clean exist on success
      process.exit(0);
    }
  });
}
