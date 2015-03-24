#!/usr/bin/env bash
# should append waitForWeave after RUN
set -e

test_num="11.1"
full_repo="bkendall/flaming-octo-nemesis"

mkdir -p ./test-"$test_num"/"$full_repo"
build_log=$(mktemp /tmp/log.XXXX)

docker run \
  -e RUNNABLE_AWS_ACCESS_KEY="$AWS_ACCESS_KEY" \
  -e RUNNABLE_AWS_SECRET_KEY="$AWS_SECRET_KEY" \
  -e RUNNABLE_FILES_BUCKET='runnable.image-builder' \
  -e RUNNABLE_PREFIX='' \
  -e RUNNABLE_FILES='{ "Dockerfile": "AolcUvaTfKOFJg74ABqL9NN08333MS_t" }' \
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
  -e RUNNABLE_WAIT_FOR_WEAVE='echo waitForWeave; ' \
  -e RUNNABLE_NETWORK_IP = '10.0.0.0' \
  -e RUNNABLE_HOST_IP = '10.0.0.1' \
  -e RUNNABLE_SAURON_HOST="$(cat DOCKER_IP):5355" \
  -e RUNNABLE_NETWORK_DRIVER="signal" \
  -v `pwd`/test-"$test_num":/cache:rw \
  -v `pwd`/test-"$test_num"/layer-cache:/layer-cache \
  test-image-builder | tee $build_log

# waitForWeave should be in output
# if grep does not see a match, it will return a non-zero code
grep -q "waitForWeave" $build_log
test "$?" = "0" || (echo "waitForWeave should be added" && false)

########################################################
# if RUNNABLE_WAIT_FOR_WEAVE not set, do not append weave
test_num="11.2"
mkdir -p ./test-"$test_num"/"$full_repo"
build_log=$(mktemp /tmp/log.XXXX)

docker run \
  -e RUNNABLE_AWS_ACCESS_KEY="$AWS_ACCESS_KEY" \
  -e RUNNABLE_AWS_SECRET_KEY="$AWS_SECRET_KEY" \
  -e RUNNABLE_FILES_BUCKET='runnable.image-builder' \
  -e RUNNABLE_PREFIX='' \
  -e RUNNABLE_FILES='{ "Dockerfile": "AolcUvaTfKOFJg74ABqL9NN08333MS_t" }' \
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
  -v `pwd`/test-"$test_num":/cache:rw \
  -v `pwd`/test-"$test_num"/layer-cache:/layer-cache \
  test-image-builder | tee $build_log

# waitForWeave should be in output
# if grep does not see a match, it will return a non-zero code
grep -q "waitForWeave" $build_log || touch $build_log.test
cat $build_log.test || (echo "waitForWeave should NOT be added" && false)
