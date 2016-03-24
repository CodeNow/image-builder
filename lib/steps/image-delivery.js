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
    var code = 502;
    var message;

    function reportGeneratedErrorAndOutput (callback) {
      return function (reportingError, generatedError) {
        if (reportingError) {
          console.error(reportingError.stack || reportingError);
        }
        callback(generatedError, output);
      };
    }

    if (err && isString(err)) {
      message = err;
      // replace silly string error with real error.
      if (ImageDelivery.isWarning(err)) {
        err.report = false
      }
      errorCat.createAndReport(
        code,
        message,
        data,
        reportGeneratedErrorAndOutput(cb)
      );
    } else if (err) {
      code = err.statusCode || 502;
      message = err.message || 'Image push failed.';
      errorCat.createAndReport(
        code,
        message,
        data,
        reportGeneratedErrorAndOutput(cb)
      );
    } else {
      cb(null, output);
    }
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
      return errorCat.createAndReport(
        code,
        message,
        data,
        function (reportingError, generatedError) {
          if (reportingError) {
            console.error(reportingError.stack || reportingError);
          }
          cb(generatedError);
        }
      );
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

/**
 * checks is error message is a warning
 * @param  {String}  errMsg message returned from docker modem
 * @return {Boolean}        true if warning
 */
ImageDelivery.isWarning = function (errMsg) {
  return !!~errMsg.indexOf('is already in progress')
}
