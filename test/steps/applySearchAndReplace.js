'use strict';

var Lab = require('lab');
var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var beforeEach = lab.beforeEach;
var afterEach = lab.afterEach;
var expect = require('code').expect;
var sinon = require('sinon');
var Transformer = require('fs-transform');
var path = require('path');

var steps = require('../../lib/steps');

describe('applySearchAndReplace', function() {
  var rules = [
    { action: 'replace', search: 'a', replace: 'b' },
    { action: 'rename', source: 'woo.txt', dest: 'ihatethis.txt' }
  ];

  var requiredEnvVars = {
    RUNNABLE_REPO: 'git@github.com:bkendall/flaming-octo-nemesis',
    SEARCH_AND_REPLACE_RULES: JSON.stringify(rules)
  };
  var oldEnvVars = {};
  var repoName;
  var repoTargetDir;
  var oldDockerContext;

  beforeEach(function (done) {
    sinon.stub(Transformer, 'transform').yieldsAsync();
    Object.keys(requiredEnvVars).forEach(function (key) {
      oldEnvVars[key] = process.env[key];
      process.env[key] = requiredEnvVars[key];
    });
    oldDockerContext = steps.dirs.dockerContext;
    steps.dirs.dockerContext = '/tmp/';
    repoName = requiredEnvVars.RUNNABLE_REPO.split('/').pop();
    repoTargetDir = path.join(steps.dirs.dockerContext, repoName);
    done();
  });

  afterEach(function (done) {
    Transformer.transform.restore();
    steps.dirs.dockerContext = oldDockerContext;
    Object.keys(requiredEnvVars).forEach(function (key) {
      process.env[key] = oldEnvVars[key];
    });
    done();
  });

  it('should use fs-transform to transform the repository', function(done) {
    steps.applySearchAndReplace(function (err) {
      if (err) { return done(err); }
      expect(Transformer.transform.calledOnce).to.be.true();
      expect(Transformer.transform.firstCall.args[0])
        .to.equal(repoTargetDir);
      expect(Transformer.transform.firstCall.args[1])
        .to.deep.equal(rules);
      done();
    });
  });

  it('should safely bypass if required environment is missing', function(done) {
    delete process.env.SEARCH_AND_REPLACE_RULES;
    steps.applySearchAndReplace(function (err) {
      if (err) { return done(err); }
      expect(Transformer.transform.callCount).to.equal(0);
      done();
    });
  });

  it('should yield errors from fs-transform', function(done) {
    var error = new Error(':(');
    Transformer.transform.yieldsAsync(error);
    steps.applySearchAndReplace(function (err) {
      expect(err).to.equal(error);
      done();
    });
  });
});
