#!/usr/bin/env bash
# multiple builds. has the repo in cache and locked.
# should both succeed
set -e

test_num="07"
full_repo="bkendall/flaming-octo-nemesis"

git clone git@github.com:bkendall/flaming-octo-nemesis ./test-"$test_num"/"$full_repo"

build () {
  commit="$1"
  docker run \
    -e RUNNABLE_AWS_ACCESS_KEY="$AWS_ACCESS_KEY" \
    -e RUNNABLE_AWS_SECRET_KEY="$AWS_SECRET_KEY" \
    -e RUNNABLE_FILES_BUCKET='runnable.image-builder' \
    -e RUNNABLE_PREFIX='' \
    -e RUNNABLE_FILES='{ "Dockerfile": "FtqXp6T2nGUU2tlqizN1NgzBRHJ2YFyd" }' \
    -e RUNNABLE_KEYS_BUCKET='runnable.image-builder' \
    -e RUNNABLE_DEPLOYKEY='flaming-octo-nemesis.key' \
    -e RUNNABLE_REPO='git@github.com:bkendall/flaming-octo-nemesis' \
    -e RUNNABLE_COMMITISH="$commit" \
    -e RUNNABLE_DOCKER="tcp://$(cat DOCKER_IP):5354" \
    -e RUNNABLE_DOCKERTAG='test-built-image' \
    -e RUNNABLE_DOCKER_BUILDOPTIONS='' \
    -v `pwd`/test-"$test_num":/cache:rw \
    test-image-builder
}

before=$(stat -t ./test-"$test_num"/"$full_repo"/.git)
build "04d07787dd44b4f2167e26532e95471871a9b233"
build "a6bcee0dfa896ba50118b465ccd9128989d231f5"
after=$(stat -t ./test-"$test_num"/"$full_repo"/.git)

# it should not be locked
test ! -d ./test-"$test_num"/"$full_repo".lock || echo 1
# the repo should exist
test -e ./test-"$test_num"/"$full_repo" || echo 2
# and the repo should be populated (from the first build)
test -f ./test-"$test_num"/"$full_repo"/README.md || echo 3
# the .git folder should have changed it's git commit
test ! "$before" = "$after" || echo 4
