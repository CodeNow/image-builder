#!/usr/bin/env bash
set -e

eval $(ssh-agent) > /dev/null 2>&1

node ./dockerBuild.js
