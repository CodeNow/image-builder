'use strict';

require('colors');
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
  var self = this;
  utils.log('Transferring image please wait ...');
  self.docker.getImage(imageName).push({
    tag: tag
  }, function(err, pushStream) {
    if (err) { return cb(err); }
    self.docker.modem.followProgress(pushStream, cb);
  });
};
