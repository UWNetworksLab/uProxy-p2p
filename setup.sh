#!/usr/bin/env bash
#
# This script will update the directly, all submodules, and build everything

START_DIR="$(pwd)"
ROOT_DIR="$(cd "$(dirname $0)"; pwd)"
PRG="$(basename "$0")"

echo "START_DIR=$START_DIR"
echo "ROOT_DIR=$ROOT_DIR"
echo "PRG=$PRG"

runcmd() {
  # For command printout messages.
  echo "* Running: $1"
  $1 || exit 1
}

echo
echo "### Install local dependencies"
runcmd "cd $ROOT_DIR"
runcmd "npm install"
runcmd "sudo npm install -g grunt-cli"
runcmd "sudo npm install -g bower"
runcmd "grunt setup"
runcmd "grunt build"
