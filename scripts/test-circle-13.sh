#!/usr/bin/env bash
# a test that includes search and replace rules!
set -e

test_num="13"
full_repo="bkendall/flaming-octo-nemesis"

mkdir -p ./test-"$test_num"/"$full_repo"

log_file=$(mktemp /tmp/log.XXXX)
docker run \
  -e RUNNABLE_AWS_ACCESS_KEY="$AWS_ACCESS_KEY" \
  -e RUNNABLE_AWS_SECRET_KEY="$AWS_SECRET_KEY" \
  -e RUNNABLE_FILES_BUCKET='runnable.image-builder' \
  -e RUNNABLE_PREFIX='' \
  -e RUNNABLE_FILES='{ "Dockerfile": "FtqXp6T2nGUU2tlqizN1NgzBRHJ2YFyd" }' \
  -e RUNNABLE_KEYS_BUCKET='runnable.image-builder' \
  -e RUNNABLE_DEPLOYKEY='flaming-octo-nemesis.key' \
  -e RUNNABLE_REPO='git@github.com:bkendall/flaming-octo-nemesis' \
  -e RUNNABLE_COMMITISH='master' \
  -e RUNNABLE_DOCKER="tcp://$(cat DOCKER_IP):5354" \
  -e RUNNABLE_DOCKERTAG='test-built-image' \
  -e RUNNABLE_DOCKER_BUILDOPTIONS='' \
  -e SEARCH_AND_REPLACE_RULES='[ { "action": "replace", "search": "FON_USER", "replace": "USER" } ]' \
  -v `pwd`/test-"$test_num":/cache:rw  \
  test-image-builder | tee $log_file

# it should not be locked
test ! -d ./test-"$test_num"/"$full_repo".lock || (echo "repo should not be locked" && false)
# the repo should exist
test -e ./test-"$test_num"/"$full_repo" || (echo "repo should exist" && false)
# and the repo should exist
test -f ./test-"$test_num"/"$full_repo"/README.md || (echo "repo should be populated" && false)
# should have replaced FON_USER in server.js
docker run --rm test-built-image grep -q "process.env.USER" /fon/server.js || (echo "should have replaced FON_USER" && false)
# should have printed that it was applying rules
grep -q "Applying search and replace rules." $log_file || (echo "should have printed that it was applying rules" && false)
