#!/usr/bin/env bash
set -e

if [ ! "$RUNNABLE_DOCKER" ]; then
  >&2 echo "Need RUNNABLE_DOCKER"
  exit 1
fi
if [ ! "$RUNNABLE_DOCKERTAG" ]; then
  >&2 echo "Need RUNNABLE_DOCKERTAG"
  exit 1
fi
if [ ! "$CACHED_LAYER" ]; then
  >&2 echo "Need CACHED_LAYER"
  exit 1
fi
if [ ! "$CACHED_LAYER_HASH" ]; then
  >&2 echo "Need CACHED_LAYER_HASH"
  exit 1
fi
if [ ! "$IMAGE_ID" ]; then
  >&2 echo "Need IMAGE_ID"
  exit 1
fi

tar_dir=$(mktemp -d /tmp/rnnbl.images.XXXXXXXXXXXXXXXXXXXX)
tar_name="$tar_dir"/"$IMAGE_ID".tar
docker -H "$RUNNABLE_DOCKER" save -o "$tar_name" "$IMAGE_ID"
cache_layer_name=$(echo "$RUNNABLE_DOCKERTAG" | awk '{split($0,a,":"); print a[1];}')
tar --extract --file "$tar_name" --directory="$tar_dir" "$CACHED_LAYER"/layer.tar
mkdir -p /layer-cache/"$cache_layer_name"
mv "$tar_dir"/"$CACHED_LAYER"/layer.tar /layer-cache/"$cache_layer_name"/"$CACHED_LAYER_HASH".tar

echo "Saved $cache_layer_name/$CACHED_LAYER_HASH.tar"
