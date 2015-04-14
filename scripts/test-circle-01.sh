#!/usr/bin/env bash
# a simple test. should successfully build
set -e

test_num="01"
full_repo="bkendall/flaming-octo-nemesis"

docker run \
  -e RUNNABLE_AWS_ACCESS_KEY="$AWS_ACCESS_KEY" \
  -e RUNNABLE_AWS_SECRET_KEY="$AWS_SECRET_KEY" \
  -e RUNNABLE_FILES_BUCKET='runnable.image-builder' \
  -e RUNNABLE_PREFIX='' \
  -e RUNNABLE_FILES='{ "Dockerfile": "K6cluDupwQdFRsuTPJ0SFUrxUB4lmF_Q" }' \
  -e RUNNABLE_REPO='https://d5efaee357114fbd442bfe088af831619b4cb0c6@github.com/bkendall/flaming-octo-nemesis' \
  -e RUNNABLE_COMMITISH='master' \
  -e RUNNABLE_DOCKER="tcp://$(cat DOCKER_IP):5354" \
  -e RUNNABLE_DOCKERTAG='test-built-image' \
  -e RUNNABLE_DOCKER_BUILDOPTIONS='' \
  test-image-builder

docker run --rm test-built-image test -d /fon || (echo "built image should have repo" && false)
test $(docker run --rm test-built-image git remote -v | awk '/push/{print($2)}') = "https://github.com/bkendall/flaming-octo-nemesis" || (echo "remote should have been renamed" && false)
echo "all tests passed"
