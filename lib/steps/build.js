'use strict';

require('colors');
var assign = require('101/assign');
var escapeRegExp = require('escape-regex-string');
var fs = require('fs');
var noop = require('101/noop');
var tar = require('tar-fs');
var path = require('path');
const normalizeAuth = require('dockerode-authconfig')
const Promise = require('bluebird')

var utils = require('../utils');
var vault = require('../external/vault')
const sshKeyReader = require('./sshKeyReader')

module.exports = Builder;

function Builder (steps) {
  this.repoRoot = steps.dirs.repoRoot;
  this.buildRoot = steps.dirs.buildRoot;
  this.dockerfileName = steps.dockerfileName;
  this.dockerfilePath = steps.runnableBuildDockerfile;
  this.dockerBuildLog = steps.logs.dockerBuild;
  this.saveToLogs = steps.saveToLogs;
  this.dockerContext = steps.dirs.dockerContext;

  if (process.env.RUNNABLE_DOCKER) {
    this.docker = require('../external/docker.js')();
  }
}

Builder.prototype.getRegistryConfig = Promise.method(() => {
  utils.log('getting registry config')
  var registryConfig = {
    url: process.env.RUNNABLE_DOCKER_REGISTRY_URL,
    username: process.env.RUNNABLE_DOCKER_REGISTRY_USERNAME
  }
  if (!process.env.RUNNABLE_SSH_KEY_IDS && (!registryConfig.url || !registryConfig.username)) {
    throw new Error('No SSH key IDs and not registry conf present')
  }
  let vaultTasks = {}
  vaultTasks.sshKeyArgs = sshKeyReader.createSSHKeys()
  if (registryConfig.url && registryConfig.username) {
    vaultTasks.registryConfig = vault.readRegistryPassword()
  }
  return Promise.props(vaultTasks)
    .then(function (resp) {
      if (resp.registryConfig && resp.registryConfig.data && resp.registryConfig.data.value) {
        var password = resp.registryConfig.data.value
        registryConfig.password = password
        utils.log('Logging into ' + registryConfig.url + ' as ' + registryConfig.username)
        return { registryConfig, sshKeyArgs: resp.sshKeyArgs }
      }
      return resp
    })
})

Builder.prototype.getLocalRegistryConfig = function () {
  const configPath = process.env.RUNNABLE_HOST_DOCKER_CONFIG_PATH || '/root/.docker/config.json'
  return Promise.fromCallback(cb => fs.readFile(configPath, cb))
    .then(buffer => buffer.toString())
    .then(JSON.parse)
    .then(normalizeAuth) // Transforms `base64` decoded auth into username and password
    .then(config => config.auths)
    .catch(() => {
      throw new Error('Docker config file not found or could not be read')
    })
}

/**
 * main entry point
 * send build command with tar context to docker daemon
 * @param  {Function} cb (err)
 */
Builder.prototype.runDockerBuild = function (cb) {
  var self = this
  var tarStream = self._getTarStream()
  var opts = {
    t: process.env.RUNNABLE_DOCKERTAG
  }

  const errHandler = err => {
    utils.log('Error fetching registry configuration (Ignoring): ' + err.message)
    return null
  }

  return Promise.props({
    registryConfAndSShKeys: self.getRegistryConfig().catch(errHandler),
    localRegistryConfig: self.getLocalRegistryConfig().catch(errHandler)
  })
  .then(function (props) {
    const registryConfAndSShKeys = props.registryConfAndSShKeys
    const localregistryConfig = props.localregistryConfigig
    if (localregistryConfig) {
      opts.registryconfig = localregistryConfig
    }
    if (registryConfAndSShKeys) {
      if (registryConfAndSShKeys.registryConfig) {
        const registryConfig = registryConfAndSShKeys.registryConfig
        opts.registryconfig = opts.registryconfig || {}
        opts.registryconfig[registryConfig.url] = {
          username: registryConfig.username,
          password: registryConfig.password
        }
      }
      // we cannot inject ssh keys into a non-repo container,
      // so we need to test for the RUNNABLE_BUILD_DOCKERFILE var
      if (registryConfAndSShKeys.sshKeyArgs && process.env.RUNNABLE_BUILD_DOCKERFILE) {
        opts.buildargs = registryConfAndSShKeys.sshKeyArgs
      }
    }
    utils.log('Runnable registries used: ' + Object.keys(opts.registryconfig || {}));
    // https://docs.docker.com/engine/reference/api/docker_remote_api_v1.22/#/build-image-from-a-dockerfile
    // Path within the build context to the Dockerfile.
    // By default we just generate 'Dockerfile'

    // if build context specified use full path to the dockerfile
    // otherwise use dockerfilename
    var runBuildContext = process.env.RUNNABLE_BUILD_DOCKER_CONTEXT;
    if (runBuildContext) {
      var absBuildContext = path.resolve('/', runBuildContext);
      utils.log('Runnable build context: ' + runBuildContext);
      utils.log('Runnable absolute build context: '+ absBuildContext);
      if (self.dockerfilePath.indexOf(absBuildContext) === 0) {
        opts.dockerfile = path.relative(absBuildContext, self.dockerfilePath);
      } else {
        opts.dockerfile = self.dockerfilePath;
      }
    } else {
      opts.dockerfile = self.dockerfileName;
    }

    utils.log('Set dockerfile: ' + opts.dockerfile);
    utils.log('Docker original context:' + self.dockerContext);
    var extraFlags = JSON.parse(process.env.RUNNABLE_BUILD_FLAGS || '{}');
    assign(opts, extraFlags);
    return Promise.fromCallback(cb => self.docker.buildImage(tarStream, opts, cb))
      .then(response => {
        return Promise.fromCallback(cb => self._handleBuild(response, cb));
      })
  })
  .asCallback(cb)
};

/**
 * should create a tar stream for buildRoot
 * @return {object} tarStream
 */
Builder.prototype._getTarStream = function () {
  var runnableBuildContext = process.env.RUNNABLE_BUILD_DOCKER_CONTEXT;
  var buildRoot = runnableBuildContext ?
    path.resolve(this.repoRoot, runnableBuildContext)
    : this.buildRoot;
  utils.log('Tar build root: ' + buildRoot + ', ' +  runnableBuildContext);
  return tar.pack(buildRoot);
};

/**
 * add handlers to build stream
 * @param  {object}   response steam to attach handlers too
 * @param  {Function} cb       (err)
 */
Builder.prototype._handleBuild = function (response, cb) {
  var self = this;
  var timeout;
  this.docker.modem.followProgress(response, onFinished, onProgress);

  function onFinished (message) {
    clearTimeout(timeout);
    // this message is a string, thanks to `followProgress`
    // success is still null, if message -> error
    var err;
    if (message) {
      err = new Error(message);
    }
    self.saveToLogs(cb)(err, '', message);
  }

  function timeoutBuild () {
    response.removeAllListeners();
    onFinished('build timeout');
  }

  function onProgress (data) {
    if (process.env.RUNNABLE_BUILD_LINE_TIMEOUT_MS) {
      clearTimeout(timeout);
      timeout = setTimeout(timeoutBuild,
        process.env.RUNNABLE_BUILD_LINE_TIMEOUT_MS);
    }
    self._handleBuildData(data);
  }
};

/**
 * performs actions based on data coming from build stream
 * @param  {string} data string from build stream
 */
Builder.prototype._handleBuildData = function (data) {
  if (data.stream) {
    var out = data.stream;
    fs.appendFileSync(this.dockerBuildLog, data.error || out);
    this.saveToLogs(noop)(null, out, '');

    if (isWaitForWeaveLine(out)) {
      out = out.replace(process.env.RUNNABLE_WAIT_FOR_WEAVE, '');
    }

    if (shouldLog(out)) {
      utils.dockerLog(out);
    }
  } else { // it's progress
    utils.progress(data);
  }
};

/**
 * checks to see if we should print this line
 * should hold a blacklist of lines we do not want to be printed to users
 * @param  {string} line check to see if we should log
 * @return {boolean}     true if we should log line, else false
 */
function shouldLog (line) {
  return ! /Removing intermediate container/.test(line);
}

/**
 * checks to see if line is a RUN wait for weave line
 * @param  {string}  line dockerfile line
 * @return {Boolean}      [description]
 */
function isWaitForWeaveLine (line) {
  // output formated like so
  // Step 7 : RUN waitForWeave
  if (!process.env.RUNNABLE_WAIT_FOR_WEAVE) { return false; }
  var regExp = '[ \t]*RUN ' + escapeRegExp(process.env.RUNNABLE_WAIT_FOR_WEAVE);
  var runRegExp = new RegExp(regExp, 'i');
  return runRegExp.test(line);
}
