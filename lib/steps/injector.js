'use strict';

/**
 * overrides dockerfile passed in
 * @param  "string" dockerfile string of dockerfile
 * @return "string" updated dockerfile
 */
module.exports = function parse(dockerfile) {
  dockerfile = dockerfile.split('\n');

  var carry = false;

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
 * add wait command before each run, skip if carry
 * @param "string" line: line of dockerfile
 * @param "string" carry: if previous line had '\' at the end
 * @return "string" updated line
 */
function addWaitForWeave (line, carry) {
  var waitForWeave = process.env.RUNNABLE_WAIT_FOR_WEAVE;
  if (!waitForWeave) { return line; }

  if (!/^[ \t]*[R|r][U|u][N|n] /.test(line) || carry) {
    return line;
  }
  return line.replace(/RUN /i, 'RUN ' + waitForWeave);
}
