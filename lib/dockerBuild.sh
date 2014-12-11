#!/usr/bin/env bash
set -e

check_head () {
  repo_commit=$(git rev-parse HEAD)
  if [[ "$repo_commit" = "$1" ]]; then
    echo "correct"
    return
  fi
  echo "fetch"
}

# Seperator for lists
IFS_BAK=$IFS
IFS=";"
# Echo colors
STYLE_BOLD="\033[1m"
STYLE_RESET="\033[0m"
COLOR_STATUS="\033[93m"
COLOR_ERROR="\033[91m"
COLOR_SUCCESS="\033[92m"
# This directory
BUILDER_LIB_DIR=$(pwd)

# Make a working directory
TEMPDIR=$(mktemp -d /tmp/rnnbl.XXXXXXXXXXXXXXXXXXXX)

if [ ! "$RUNNABLE_AWS_ACCESS_KEY" ] || [ ! "$RUNNABLE_AWS_SECRET_KEY" ]; then
  echo -e "${STYLE_BOLD}${COLOR_ERROR}Missing credentials.${STYLE_RESET}"
  exit 1
fi

# GET DEPLOY KEY ($RUNNABLE_DEPLOYKEY)
TEMPKEYDIR=$(mktemp -d /tmp/rnnbl.key.XXXXXXXXXXXXXXXXXXXX)
read -a KEY_ARRAY <<< "$RUNNABLE_DEPLOYKEY"
if [ "$RUNNABLE_DEPLOYKEY" ]; then
  if [ "$(ssh-add > /dev/null 2>&1)" != "0" ]; then
    eval $(ssh-agent) > /dev/null
  fi
  for KEY in $RUNNABLE_DEPLOYKEY; do
    node downloadS3Files.js \
      --bucket "$RUNNABLE_KEYS_BUCKET" \
      --file "$KEY" \
      --dest "$TEMPKEYDIR" > /dev/null
    chmod 600 "$TEMPKEYDIR"/"$KEY"
  done
fi

# GIT CLONE
read -a REPO_ARRAY <<< "$RUNNABLE_REPO"
read -a COMMITISH_ARRAY <<< "$RUNNABLE_COMMITISH"
# used to check if cache is locked
unset LOCKED
# will skip cache and clone if set
unset CLONE
# ensure we have a /cache directory
mkdir -p /cache
for index in "${!REPO_ARRAY[@]}"
do
  REPO_DIR=$(echo "${REPO_ARRAY[index]}" | awk '{split($0,r,"/"); print r[2];}')
  REPO_FULL_NAME=$(echo "${REPO_ARRAY[index]}" | awk '{split($0,r,":"); print r[2];}')
  mkdir -p "$(dirname /cache/$REPO_FULL_NAME)"
  echo -e "${STYLE_BOLD}${COLOR_STATUS}Cloning '$REPO_FULL_NAME' into './$REPO_DIR'...${STYLE_RESET}"
  pushd $TEMPDIR > /dev/null
  ssh-add -D > /dev/null 2>&1
  ssh-add "$TEMPKEYDIR"/"${KEY_ARRAY[index]}" > /dev/null 2>&1

  # wait for lock on this repo
  for STEP in {0..5}; do
    LOCKED='true'
    sleep $STEP
    echo -n "."
    mkdir /cache/"$REPO_FULL_NAME".lock > /dev/null 2>&1 && break
    unset LOCKED
  done
  echo ""

  # if locked use cache, else just clone
  if [[ $LOCKED ]]; then
    if [[ ! "$(ls -A /cache/$REPO_FULL_NAME 2>/dev/null)" ]]; then
      git clone -q "${REPO_ARRAY[index]}" "/cache/$REPO_FULL_NAME" || CLONE="true"
    fi
    # have to check it out
    if [ "$RUNNABLE_COMMITISH" ]; then
      pushd "/cache/$REPO_FULL_NAME" > /dev/null
      check=$(check_head $RUNNABLE_COMMITISH)
      if [[ "$check" = "fetch" ]]; then
        git fetch --all || CLONE="true"
        git checkout -q "${COMMITISH_ARRAY[index]}" || CLONE="true"
      fi
      popd > /dev/null
    fi
    if [[ ! "$CLONE" ]]; then
      cp -r "/cache/$REPO_FULL_NAME" "$REPO_DIR" || CLONE="true"
    fi

    if [[ ! "$CLONE" ]]; then
      # touch all the things
      SAVE_IFS=$IFS
      IFS="
"
      for file in $(cd "/cache/$REPO_FULL_NAME" && find .)
      do
        # if this fails, we don't need to worry - we have a full copy of it already, the docker cache just may miss
        touch --no-dereference --reference="/cache/$REPO_FULL_NAME/$file" "$REPO_DIR"/"$file" || true
      done
      IFS=$SAVE_IFS
    fi

    # release copy lock, this will remove stale locks because we did a full git clone.
    rm -rf /cache/"$REPO_FULL_NAME".lock > /dev/null 2>&1 || true
  fi

  # fallback to clone if anything failed above
  if [[ "$CLONE" || ! -d "$REPO_DIR" ]]; then
    rm -rf "$REPO_DIR" || true
    git clone -q "${REPO_ARRAY[index]}" "$REPO_DIR"

    # Enter the repository
    pushd $REPO_DIR > /dev/null
    if [ "$RUNNABLE_COMMITISH" ]; then
      git checkout -q "${COMMITISH_ARRAY[index]}"
    fi
    # Leave repo folder
    popd > /dev/null
  fi

  # Leave temp folder
  popd > /dev/null
  echo ""
done

# S3 DOWNLOAD
if [ "$RUNNABLE_FILES" ]; then
  echo -e  "${STYLE_BOLD}${COLOR_STATUS}Downloading build files...${STYLE_RESET}"
  node downloadS3Files.js \
    --bucket "$RUNNABLE_FILES_BUCKET" \
    --files "$RUNNABLE_FILES" \
    --prefix "$RUNNABLE_PREFIX" \
    --dest "$TEMPDIR"
  echo ""
fi

# DOCKER BUILD
if [ "$RUNNABLE_DOCKER" ] && [ "$RUNNABLE_DOCKERTAG" ]; then
  echo -e  "${STYLE_BOLD}${COLOR_STATUS}Building box...${STYLE_RESET}"
  docker -H\="$RUNNABLE_DOCKER" build \
    -t "$RUNNABLE_DOCKERTAG" \
    $RUNNABLE_DOCKER_BUILDOPTIONS \
    "$TEMPDIR"
  echo ""
fi

echo -e  "${STYLE_BOLD}${COLOR_SUCCESS}Build completed successfully!${STYLE_RESET}"

IFS=$IFS_BAK
IFS_BAK=
