#!/usr/bin/env bash
# a locked directory (some other thing may be using the cache)
# should successfully finish, just cloning
set -e

test_num="02"
full_repo="bkendall/flaming-octo-nemesis"

mkdir -p ./test-"$test_num"/"$full_repo"
mkdir -p ./test-"$test_num"/"$full_repo".lock

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
  -e RUNNABLE_DOCKER="tcp://$(cat DOCKER_IP):5354" \
  -e RUNNABLE_DOCKERTAG='test-built-image' \
  -e RUNNABLE_DOCKER_BUILDOPTIONS='' \
  -v `pwd`/test-"$test_num":/cache:rw \
  test-image-builder

# it should still be locked
test -d ./test-"$test_num"/"$full_repo".lock
# the directory should exist
test -e ./test-"$test_num"/"$full_repo"
# and in this case, it should be empty
test ! -f ./test-"$test_num"/"$full_repo"/README.md
