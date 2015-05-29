#!/usr/bin/env bash
# multiple builds. has the repo in cache and locked.
# should both succeed
set -e

test_num="04"
full_repo="bkendall/flaming-octo-nemesis"

git clone git@github.com:bkendall/flaming-octo-nemesis ./test-"$test_num"/"$full_repo"

build () {
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
    -v `pwd`/test-"$test_num":/cache:rw \
    test-image-builder &
  build_pid="$!"
}

wait_pid () {
  pid=$1
  while test -d "/proc/$pid" 2> /dev/null
  do
    sleep 1
  done
  echo "$pid" has completed
}

build
WAIT_ON_PID=$build_pid
wait_pid $WAIT_ON_PID
build
wait_pid $build_pid

# it should not be locked
test ! -d ./test-"$test_num"/"$full_repo".lock
# the repo should exist
test -e ./test-"$test_num"/"$full_repo"
# and the repo should be populated (from the first build)
test -f ./test-"$test_num"/"$full_repo"/README.md
