#!/usr/bin/env bash
# two back to back builds to make sure the second actually uses the cache
set -e

test_num="09"
full_repo="bkendall/flaming-octo-nemesis"

# make sure there's nothing in this layer cache
if [[ -d ./test-"$test_num" ]]; then
  rm -rf ./test-"$test_num"
fi
mkdir -p ./test-"$test_num"/"$full_repo"
mkdir -p ./test-"$test_num"/layer-cache

build () {
  build_log=$1
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
    -v `pwd`/test-"$test_num"/layer-cache:/layer-cache \
    test-image-builder | tee $build_log
}

checks () {
  should_have_archiver=1
  should_have_archiver=$1

  echo "looking for archiver and waiting"
  # the archiver should be running
  running_containers=$(docker ps --no-trunc | grep "dockerLayerArchive" | wc -l)
  if [ $should_have_archiver -gt 0 ]; then
    test $running_containers = "$should_have_archiver" || (echo "container should be running dockerLayerArchive" && false)
    # wait for the container, and it should be successfull
    docker wait $(docker ps  --no-trunc | grep "dockerLayerArchive" | awk '{print $1}')
  else
    # no containers should be running
    test $running_containers = "$should_have_archiver" || (echo "container should not be running dockerLayerArchive" && false)
  fi

  echo "checking layer cache status"
  # layer-cache tests
  # directory and layer should exist
  test -d ./test-"$test_num"/layer-cache/test/test-built-image || (echo "directory for layer should exist" && false)
  ls ./test-"$test_num"/layer-cache/test/test-built-image/*.tar 1> /dev/null 2>&1 || (echo "layer.tar should exist" && false)
}

first_log=$(mktemp /tmp/log.XXXX)
second_log=$(mktemp /tmp/log.XXXX)

echo "FIRST BUILD"
build $first_log
checks 1
grep -vqE "ADD [0-9a-f]+\.tar /" "$first_log" || (echo "should not have added the layer in the first build" && false)
echo "SECOND BUILD"
build $second_log
checks 0
grep -qE "ADD [0-9a-f]+\.tar /" "$second_log" || (echo "should have added the layer in the second build" && false)
echo "tests are done"
