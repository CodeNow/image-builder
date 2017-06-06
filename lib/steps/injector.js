'use strict';

const sshKeyReader = require('./sshKeyReader')
var WAIT_FOR_CHARON = ' sleep 10; ';
/**
 * overrides dockerfile passed in
 * @param  {string} dockerfile string of dockerfile
 * @return {string} updated dockerfile
 */
module.exports = function parse(dockerfile) {
  dockerfile = dockerfile.split('\n');

  var carry = false;
  if (process.env.SSH_KEY_IDS && process.env.RUNNABLE_BUILD_DOCKERFILE) {
    sshKeyReader.addToKeyring(dockerfile)
  }
  // this goes in order changing the dockerfile
  dockerfile.forEach(function(line, index) {
    var newLine = addWaitForWeave(line, carry);
    // must be set last, checks for \ at the end of the line
    carry = /\\[ \t]*$/.test(line);

    dockerfile[index] = newLine;
  });
  return dockerfile.join('\n');
};

/**
 * add wait command before each run and cmd, skip if carry
 * @param {string}  line    line of dockerfile
 * @param {string}  carry   if previous line had '\' at the end
 * @return {string} updated line
 */
function addWaitForWeave (line, carry) {
  var waitForWeave = process.env.RUNNABLE_WAIT_FOR_WEAVE;
  if (!waitForWeave || carry) { return line; }

  // Looks for a ^RUN with one space after, ignoring prev whitespace
  var runRegExp = /^[ \t]*(RUN )/i.exec(line);
  if (runRegExp) {
    return line.replace(runRegExp[0],
      runRegExp[0] + waitForWeave);
  }

  return addWeaveToCmdLine(line, waitForWeave);
}
/**
 * will add wait for weave to CMD line
 * CMD has 2 formats
 * CMD command
 * CMD ['command']
 * we convert second format to first here to allow wait for weave loop
 * @param  {string} line            line of dockerfile
 * @param  {string} waitForWeave    string to append to match
 * @return {string} updated line if CMD, line if no mutation needed
 */
function addWeaveToCmdLine (line, waitForWeave) {
  // looks for a ^CMD [*]$ ignoring whitespace
  var bracketRegExp = /^[ \t]*CMD[ \t]+\[.*\][ \t]*$/i.exec(line);
  if (bracketRegExp) {
    // parse the array of strings then join together with spaces
    var cmd = JSON.parse(/\[.*\]/.exec(line)[0]).join(' ');
    // replace [] with normal cmd
    line = line.replace(/\[.*\]/, cmd);
  }
  // looks for ^CMD * ignoring whitespace
  var cmdRegExp = /^[ \t]*(CMD )/i.exec(line);
  if (cmdRegExp) {
    return line.replace(cmdRegExp[0],
      cmdRegExp[0] + waitForWeave + WAIT_FOR_CHARON);
  }
  return line;
}
