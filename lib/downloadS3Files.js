'use strict';

var aws = require('aws-sdk');
var async = require('async');
var miss = require('mississippi');
var mkdirp = require('mkdirp');

var path = require('path');
var join = path.join;
var fs = require('fs');

main();

function main () {
  /* arguments
   * --bucket *
   * --file
   * --files
   * --prefix *
   * --dest *
   */
  var argv = require('minimist')(process.argv.slice(2));

  var bucket = argv.bucket;
  var prefix = argv.prefix || '';
  if (prefix.slice(-1) === '/') { prefix = prefix.slice(0, -1); }
  var files = argv.files ? JSON.parse(argv.files) : null;
  var file = argv.file;
  var dest = argv.dest;

  if (file && !files) {
    downloadFile(
      bucket,
      file,
      prefix,
      null,
      dest,
      handleResponse);
  } else if (files && !file) {
    downloadFiles(
      bucket,
      files,
      prefix,
      dest,
      handleResponse);
  } else {
    // color bold and red?
    console.error('Need a file to download!');
    process.exit(2);
  }

  function handleResponse (err) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  }
}

function downloadFiles (bucket, files, filePrefix, tempDir, callback) {
  var fileActions = [];
  Object.keys(files).forEach(function (key) {
    fileActions.push(downloadFile.bind(this,
      bucket,
      key,
      filePrefix,
      files[key],
      tempDir
    ));
  });
  async.parallel(fileActions, callback);
}

function streamFileFromS3 (fileName, file, data, callback) {
  aws.config.update({
    accessKeyId: process.env.RUNNABLE_AWS_ACCESS_KEY,
    secretAccessKey: process.env.RUNNABLE_AWS_SECRET_KEY
  });
  var s3 = new aws.S3();
  var destFile = fs.createWriteStream(fileName);
  var s3ReadStream = s3.getObject(data).createReadStream();
  s3ReadStream.pipe(destFile);
  miss.finished(destFile, function (err) {
    if (err) {
      console.log('write failed', err);
      return callback(err);
    }
    console.log('\t' + file);
    callback(null, fileName);
  });
}


function downloadFile (bucket, file, prefix, version, dest, callback) {

  var data = {
    Bucket: bucket,
    Key: file
  };
  if (version) {
    data.VersionId = version;
  }

  // ensure pathes exist
  file = file.slice(prefix.length);
  var fileName = join(dest, file);
  // create directory
  if (fileName.slice(-1) === '/') {
    fs.exists(fileName, function (exists) {
      if (exists) { callback(null, fileName); }
      else {
        mkdirp(fileName, function (err) {
          console.log('\t' + file);
          callback(err, fileName);
        });
      }
    });
  } else {
    fs.exists(path.dirname(fileName), function (exists) {
      if (!exists) {
        mkdirp(path.dirname(fileName), function (err) {
          if (err) { return callback(err); }
          streamFileFromS3(fileName, file, data, callback);
        });
      } else {
        streamFileFromS3(fileName, file, data, callback);
      }
    });
  }
}
