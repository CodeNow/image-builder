#!/usr/bin/env bash
# build repo folder dockerfile
set -e

build_log=$(mktemp /tmp/log.XXXX)

docker run \
  -e RUNNABLE_AWS_ACCESS_KEY="$AWS_ACCESS_KEY" \
  -e RUNNABLE_AWS_SECRET_KEY="$AWS_SECRET_KEY" \
  -e RUNNABLE_FILES_BUCKET='runnable.image-builder' \
  -e RUNNABLE_PREFIX='' \
  -e RUNNABLE_FILES='{ "Dockerfile": "FtqXp6T2nGUU2tlqizN1NgzBRHJ2YFyd" }' \
  -e RUNNABLE_KEYS_BUCKET='runnable.image-builder' \
  -e RUNNABLE_DEPLOYKEY='image-builder.key' \
  -e RUNNABLE_REPO='git@github.com:Runnable/image-builder-test' \
  -e RUNNABLE_COMMITISH='master' \
  -e RUNNABLE_DOCKER="tcp://$(cat DOCKER_IP):5354" \
  -e RUNNABLE_DOCKERTAG='test-built-image' \
  -e RUNNABLE_DOCKER_BUILDOPTIONS='' \
  -e RUNNABLE_BUILD_DOCKERFILE='/build/Dockerfile.test' \
  test-image-builder | tee $build_log

# should have printed repo folder dockerfile
grep -vqE "repo folder dockerfile" "$build_log" || (echo "should have printed repo folder dockerfile" && false)
