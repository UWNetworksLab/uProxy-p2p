#!/bin/bash

# Creates the .zips used in preparation for
# releasing uProxy for Chrome:
#  - build/dist/uproxy-chrome.zip is for team fishfood
#  - build/dist/chrome/uproxy-chrome-*.zip have the key
#    in their manifests stripped and are for uploading
#    to the Chrome Web Store
#
# This is intended to be called as part of "grunt dist".

readonly DIST_DIR=build/dist
readonly REQUIRED_COMMANDS="zip jq"

set -e

if [ ! -d $DIST_DIR ]; then
  echo "could not find directory $DIST_DIR, have you run grunt dist?" >&2
  exit 1
fi

command_exists() {
  command -v "$@" > /dev/null 2>&1
}

for command in $REQUIRED_COMMANDS
do
  if ! command_exists $command
  then
    echo "could not $command, please install requirements first: $REQUIRED_COMMANDS" >&2
    exit 1
  fi
done

# Fishfood.
pushd $DIST_DIR &>/dev/null
zip -r uproxy-chrome.zip chrome

# Chrome Web Store.
pushd chrome &>/dev/null

for manifest in app/manifest.json extension/manifest.json; do
  jq 'del(.key)' $manifest > $manifest.tmp
  mv $manifest.tmp $manifest
done

zip -r uproxy-chrome-app.zip app
zip -r uproxy-chrome-extension.zip extension
