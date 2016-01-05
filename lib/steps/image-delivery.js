'use strict';

require('colors');
var errorCat = require('../external/error-cat.js');
var isString = require('101/is-string');
var utils = require('../utils');

module.exports = ImageDelivery;

function ImageDelivery () {
  this.docker = require('../external/docker.js')();
}
/**
 * pushes docker image to registry. cb when push is finished
 * @param  {string}   imageId id of image to push to registry
 *                            format: registry.runnable.com/123/456:<tag>
 * @param  {Function} cb      (err)
 */
ImageDelivery.prototype.pushImage = function (imageId, cb) {
  var imageName = imageId.split(':')[0];
  var tag = imageId.split(':')[1];

  function finalCallback (err, output) {
    var data = {
      err: err,
      imageId: imageId,
      imageName: imageName
    };
    if (err && isString(err)) {
      var code = 502;
      var message = err;
      // replace silly string error with real error.
      err = errorCat.createAndReport(code, message, data);
    } else if (err) {
      var code = err.statusCode || 502;
      var message = err.message || 'Image push failed.';
      errorCat.createAndReport(code, message, data);
    }
    cb(err, output);
  }

  var self = this;
  utils.log('Transferring image please wait ...');
  self.docker.getImage(imageName).push({
    tag: tag
  }, function (err, pushStream) {
    if (err) {
      var code = err.statusCode || 500;
      var message = err.message || 'Image failed to start push.';
      var data = {
        err: err,
        imageId: imageId,
        imageName: imageName
      };
      errorCat.createAndReport(code, message, data);
      return cb(err);
    }
    self.docker.modem.followProgress(
      pushStream,
      finalCallback,
      function progressCallback (data) {
        utils.progress(data);
      }
    );
  });
};
