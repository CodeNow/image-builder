#!/usr/bin/env bash
# should finish after waitForWeave command
set -e

test_num="12.1"
full_repo="bkendall/flaming-octo-nemesis"

mkdir -p ./test-"$test_num"/"$full_repo"

docker run \
  -e RUNNABLE_AWS_ACCESS_KEY="$AWS_ACCESS_KEY" \
  -e RUNNABLE_AWS_SECRET_KEY="$AWS_SECRET_KEY" \
  -e RUNNABLE_FILES_BUCKET='runnable.image-builder' \
  -e RUNNABLE_PREFIX='' \
  -e RUNNABLE_FILES='{ "Dockerfile": "lsPMUA7EcT2CqOEKYhlcpUaUmLLU_Gq." }' \
  -e RUNNABLE_KEYS_BUCKET='runnable.image-builder' \
  -e RUNNABLE_DEPLOYKEY='flaming-octo-nemesis.key' \
  -e RUNNABLE_REPO='git@github.com:bkendall/flaming-octo-nemesis' \
  -e RUNNABLE_COMMITISH='master' \
  -e RUNNABLE_DOCKER="tcp://$(cat DOCKER_IP):5354" \
  -e RUNNABLE_DOCKERTAG='test/test-built-image:sometag' \
  -e RUNNABLE_DOCKER_BUILDOPTIONS='' \
  -e RUNNABLE_IMAGE_BUILDER_NAME='test-image-builder' \
  -e RUNNABLE_IMAGE_BUILDER_TAG='latest' \
  -e DOCKER_IMAGE_BUILDER_LAYER_CACHE="`pwd`/test-$test_num/layer-cache" \
  -e RUNNABLE_WAIT_FOR_WEAVE='trap "echo | nc -q 0 localhost 5356" INT; nc -l -p 5356 & wait; ' \
  -e RUNNABLE_NETWORK_IP='10.0.0.0' \
  -e RUNNABLE_HOST_IP='10.0.0.1' \
  -e RUNNABLE_SAURON_HOST="$(cat DOCKER_IP):5355" \
  -e RUNNABLE_NETWORK_DRIVER='signal' \
  -v `pwd`/test-"$test_num":/cache:rw \
  -v `pwd`/test-"$test_num"/layer-cache:/layer-cache \
  test-image-builder

test "$?" = "0" || (echo "build failed probably weave" && false)

########################################################
# should fail if attach went wrong
test_num="12.2"
mkdir -p ./test-"$test_num"/"$full_repo"
testlog=$(mktemp /tmp/log.XXXX)

docker run \
  -e RUNNABLE_AWS_ACCESS_KEY="$AWS_ACCESS_KEY" \
  -e RUNNABLE_AWS_SECRET_KEY="$AWS_SECRET_KEY" \
  -e RUNNABLE_FILES_BUCKET='runnable.image-builder' \
  -e RUNNABLE_PREFIX='' \
  -e RUNNABLE_FILES='{ "Dockerfile": "lsPMUA7EcT2CqOEKYhlcpUaUmLLU_Gq." }' \
  -e RUNNABLE_KEYS_BUCKET='runnable.image-builder' \
  -e RUNNABLE_DEPLOYKEY='flaming-octo-nemesis.key' \
  -e RUNNABLE_REPO='git@github.com:bkendall/flaming-octo-nemesis' \
  -e RUNNABLE_COMMITISH='master' \
  -e RUNNABLE_DOCKER="tcp://$(cat DOCKER_IP):5354" \
  -e RUNNABLE_DOCKERTAG='test/test-built-image:sometag' \
  -e RUNNABLE_DOCKER_BUILDOPTIONS='' \
  -e RUNNABLE_IMAGE_BUILDER_NAME='test-image-builder' \
  -e RUNNABLE_IMAGE_BUILDER_TAG='latest' \
  -e DOCKER_IMAGE_BUILDER_LAYER_CACHE="`pwd`/test-$test_num/layer-cache" \
  -e RUNNABLE_WAIT_FOR_WEAVE='nc -l 5356; ' \
  -e RUNNABLE_NETWORK_IP='10.0.0.0' \
  -e RUNNABLE_HOST_IP='10.0.0.1' \
  -e RUNNABLE_SAURON_HOST="$(cat DOCKER_IP):5355" \
  -e RUNNABLE_NETWORK_DRIVER='signal' \
  -e SAURON_FAIL='yes' \
  -v `pwd`/test-"$test_num":/cache:rw \
  -v `pwd`/test-"$test_num"/layer-cache:/layer-cache \
  test-image-builder || touch $testlog.test

cat $testlog.test || (echo "build should have failed because of weave" && false)
