#!/usr/bin/env bash
# Test whether loading a config.json as volume successfully logs in to docker
# Depends on this branch of image-builder-test: https://github.com/Runnable/image-builder-test/tree/test-private-registries
# Depends on `runnable+image_builder_tester` robot account in quay
# Depends on `image-builder-test:test-private-registry` image in quay: runnable+image_builder_tester
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
  -e RUNNABLE_COMMITISH='44ac246c984ae2b168437a765175b12018329745' \
  -e RUNNABLE_DOCKER="tcp://$(cat DOCKER_IP):5354" \
  -e RUNNABLE_DOCKERTAG='test-built-image' \
  -e RUNNABLE_DOCKER_BUILDOPTIONS='' \
  -e RUNNABLE_BUILD_DOCKERFILE='/Dockerfile' \
  -v `pwd`/runnable-image-builder-tester-auth:/root/docker/config.json:r
  test-image-builder | tee $build_log

# should exit successfully
31:grep -vqE "Runnable: Build completed successfully" "$build_log" || (echo "should have printed Runnable: Build completed successfully" && false)
