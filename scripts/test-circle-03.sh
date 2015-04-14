#!/usr/bin/env bash
# first layer cache test
set -e

test_num="08"
full_repo="bkendall/flaming-octo-nemesis"

# make sure there's nothing in this layer cache
if [[ -d ./test-"$test_num" ]]; then
  rm -rf ./test-"$test_num"
fi
mkdir -p ./test-"$test_num"/layer-cache

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
  test-image-builder

echo "checking repo status"
docker run test-built-image test -d /fon || (echo "built image should have repo" && false)
test $(docker run test/test-built-image:sometag git rev-parse --abbrev-ref HEAD) = "master" || (echo "should have checked out given revision (master)" && false)

echo "looking for archiver and waiting"
# the archiver should be running
running_containers=$(docker ps --no-trunc | grep "dockerLayerArchive" | wc -l)
test $running_containers = "1" || (echo "container should be running dockerLayerArchive" && false)
# wait for the container, and it should be successfull
docker wait $(docker ps --no-trunc | grep "dockerLayerArchive" | awk '{print $1}')

echo "checking layer cache status"
# layer-cache tests
# directory and layer should exist
test -d ./test-"$test_num"/layer-cache/test/test-built-image || (echo "directory for layer should exist" && false)
ls ./test-"$test_num"/layer-cache/test/test-built-image/*.tar 1> /dev/null 2>&1 || (echo "layer.tar should exist" && false)
echo "tests are done"
