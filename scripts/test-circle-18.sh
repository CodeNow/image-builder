#!/usr/bin/env bash
# build root repo dockerfile
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
  -e RUNNABLE_COMMITISH='c30225719cebe59ed78e3849e392c83e79d03d42' \
  -e RUNNABLE_DOCKER="tcp://$(cat DOCKER_IP):5354" \
  -e RUNNABLE_DOCKERTAG='test-built-image' \
  -e RUNNABLE_DOCKER_BUILDOPTIONS='' \
  -e RUNNABLE_BUILD_DOCKERFILE='/Dockerfile' \
  test-image-builder | tee $build_log

# should have printed root repo dockerfile
grep -vqE "root repo dockerfile" "$build_log" || (echo "should have printed root repo dockerfile" && false)
