#!/usr/bin/env bash
# a test without the cache. should be successful
set -e

test_num="03"
full_repo="bkendall/flaming-octo-nemesis"

mkdir -p ./test-"$test_num"

docker run \
  -e RUNNABLE_AWS_ACCESS_KEY="$AWS_ACCESS_KEY" \
  -e RUNNABLE_AWS_SECRET_KEY="$AWS_SECRET_KEY" \
  -e RUNNABLE_FILES_BUCKET='runnable.image-builder' \
  -e RUNNABLE_PREFIX='' \
  -e RUNNABLE_FILES='{ "Dockerfile": "K6cluDupwQdFRsuTPJ0SFUrxUB4lmF_Q" }' \
  -e RUNNABLE_KEYS_BUCKET='runnable.image-builder' \
  -e RUNNABLE_DEPLOYKEY='flaming-octo-nemesis.key' \
  -e RUNNABLE_REPO='git@github.com:bkendall/flaming-octo-nemesis' \
  -e RUNNABLE_COMMITISH='master' \
  -e RUNNABLE_DOCKER="$(cat DOCKER_IP):5354" \
  -e RUNNABLE_DOCKERTAG='test-built-image' \
  -e RUNNABLE_DOCKER_BUILDOPTIONS='' \
  test-image-builder

# since we used no cache, none of these should be true
# it should not be locked
test ! -d ./test-"$test_num"/"$full_repo".lock
# the repo should not exist
test ! -e ./test-"$test_num"/"$full_repo"
# and the repo should not be cloned _in the cache_
test ! -f ./test-"$test_num"/"$full_repo"/README.md
