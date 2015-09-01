#!/usr/bin/env bash
# ensures push-image is run
set -e

test_num="14"
full_repo="bkendall/flaming-octo-nemesis"

mkdir -p ./test-"$test_num"/"$full_repo"

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
  -e RUNNABLE_PUSH_IMAGE='true' \
  -e RUNNABLE_IMAGE_BUILDER_NAME='test-image-builder' \
  -e RUNNABLE_IMAGE_BUILDER_TAG='latest' \
  -v `pwd`/test-"$test_num":/cache:rw  \
  test-image-builder

# it should not be locked
test ! -d ./test-"$test_num"/"$full_repo".lock || (echo "repo should not be locked" && false)
# the repo should exist
test -e ./test-"$test_num"/"$full_repo" || (echo "repo should exist" && false)
# and the repo should exist
test -f ./test-"$test_num"/"$full_repo"/README.md || (echo "repo should be populated" && false)

echo "looking for push-image and waiting"
# the push-image should be running
running_containers=$(docker ps --no-trunc | grep "push-image" | wc -l)
test $running_containers = "1" || (echo "container should be running push-image" && false)
# wait for the container, and it should be successful
docker wait $(docker ps  --no-trunc | grep "push-image" | awk '{print $1}')

echo "checking layer cache status"

