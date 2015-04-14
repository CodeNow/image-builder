#!/usr/bin/env bash
# should finish after waitForWeave command
set -e

test_num="12.1"
full_repo="bkendall/flaming-octo-nemesis"

mkdir -p ./test-"$test_num"/"$full_repo"

echo "starting first build (should succeed)"
docker run \
  -e RUNNABLE_AWS_ACCESS_KEY="$AWS_ACCESS_KEY" \
  -e RUNNABLE_AWS_SECRET_KEY="$AWS_SECRET_KEY" \
  -e RUNNABLE_FILES_BUCKET='runnable.image-builder' \
  -e RUNNABLE_PREFIX='' \
  -e RUNNABLE_FILES='{ "Dockerfile": "AolcUvaTfKOFJg74ABqL9NN08333MS_t" }' \
  -e RUNNABLE_REPO='https://d5efaee357114fbd442bfe088af831619b4cb0c6@github.com/bkendall/flaming-octo-nemesis' \
  -e RUNNABLE_COMMITISH='master' \
  -e RUNNABLE_DOCKER="tcp://$(cat DOCKER_IP):5354" \
  -e RUNNABLE_DOCKERTAG='test/test-built-image:sometag' \
  -e RUNNABLE_DOCKER_BUILDOPTIONS='' \
  -e RUNNABLE_IMAGE_BUILDER_NAME='test-image-builder' \
  -e RUNNABLE_IMAGE_BUILDER_TAG='latest' \
  -e DOCKER_IMAGE_BUILDER_LAYER_CACHE="`pwd`/test-$test_num/layer-cache" \
  -e RUNNABLE_WAIT_FOR_WEAVE='trap "echo | nc localhost 5356" INT; nc -l 5356 & wait; ' \
  -e RUNNABLE_NETWORK_IP='10.0.0.0' \
  -e RUNNABLE_HOST_IP='10.0.0.1' \
  -e RUNNABLE_SAURON_HOST="$(cat DOCKER_IP):5355" \
  -e RUNNABLE_NETWORK_DRIVER='signal' \
  -v `pwd`/test-"$test_num"/layer-cache:/layer-cache \
  test-image-builder
echo "first build successful"


########################################################
# should fail if attach went wrong
test_num="12.2"
mkdir -p ./test-"$test_num"/"$full_repo"
testlog=$(mktemp /tmp/log.XXXX)

echo "starting second build (going to fail)"
docker run \
  -e RUNNABLE_AWS_ACCESS_KEY="$AWS_ACCESS_KEY" \
  -e RUNNABLE_AWS_SECRET_KEY="$AWS_SECRET_KEY" \
  -e RUNNABLE_FILES_BUCKET='runnable.image-builder' \
  -e RUNNABLE_PREFIX='' \
  -e RUNNABLE_FILES='{ "Dockerfile": "AolcUvaTfKOFJg74ABqL9NN08333MS_t" }' \
  -e RUNNABLE_REPO='https://d5efaee357114fbd442bfe088af831619b4cb0c6@github.com/bkendall/flaming-octo-nemesis' \
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
  -v `pwd`/test-"$test_num"/layer-cache:/layer-cache \
  test-image-builder 2>&1 | tee $testlog || true
echo "done with the build"

grep -q "error attaching to runnable network" $testlog || (echo "build should have failed because of weave" && false)
