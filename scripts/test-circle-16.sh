#!/usr/bin/env bash
# timeout test
set -e

test_num="16"
full_repo="bkendall/flaming-octo-nemesis"

mkdir -p ./test-"$test_num"/"$full_repo"

build_log=$(mktemp /tmp/log.XXXX)

# build should timeout
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
  -e RUNNABLE_BUILD_LINE_TIMEOUT_MS=1 \
  -v `pwd`/test-"$test_num":/cache:rw  \
  test-image-builder | tee $build_log

exit_code=`docker wait $(docker ps -a -n=1 --no-trunc | grep 'test-image-builder' | awk '{print $1}')`
test "$exit_code" = "124" || (echo "should have exit code 124 " && false)

# should print timeout
grep -vqE "Runnable: build timeout" "$build_log" || (echo "should have printed build timeout" && false)

# build should not timeout
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
  -e RUNNABLE_BUILD_LINE_TIMEOUT_MS=999999999 \
  -v `pwd`/test-"$test_num":/cache:rw  \
  test-image-builder

# should exit successfully
exit_code=`docker wait $(docker ps -a -n=1 --no-trunc | grep 'test-image-builder' | awk '{print $1}')`
test "$exit_code" = "0" || (echo "should have exit code 0 " && false)
