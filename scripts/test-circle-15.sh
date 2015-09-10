#!/usr/bin/env bash
# a simple test. should successfully build
set -e

test_num="15"
full_repo="bkendall/flaming-octo-nemesis"

mkdir -p ./test-"$test_num"/"$full_repo"

build_log=$(mktemp /tmp/log.XXXX)

docker run \
  -e RUNNABLE_AWS_ACCESS_KEY="$AWS_ACCESS_KEY" \
  -e RUNNABLE_AWS_SECRET_KEY="$AWS_SECRET_KEY" \
  -e RUNNABLE_FILES_BUCKET='runnable.image-builder' \
  -e RUNNABLE_PREFIX='' \
  -e RUNNABLE_FILES='{ "Dockerfile": "Dgz_x187R1YUv8XL19QsqXUQSnbxlvtS" }' \
  -e RUNNABLE_KEYS_BUCKET='runnable.image-builder' \
  -e RUNNABLE_DEPLOYKEY='flaming-octo-nemesis.key' \
  -e RUNNABLE_REPO='git@github.com:bkendall/flaming-octo-nemesis' \
  -e RUNNABLE_COMMITISH='master' \
  -e RUNNABLE_DOCKER="tcp://$(cat DOCKER_IP):5354" \
  -e RUNNABLE_DOCKERTAG='test-built-image' \
  -e RUNNABLE_DOCKER_BUILDOPTIONS='' \
  -v `pwd`/test-"$test_num":/cache:rw  \
  test-image-builder | tee $build_log

grep -vqE "Runnable: test-file: no such file" "$build_log" || (echo "should have printed no such file" && false)
