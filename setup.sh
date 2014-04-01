#!/usr/bin/env bash
#
# This script will update the directly, all submodules, and build everything

START_DIR="$(pwd)"
ROOT_DIR="$(cd "$(dirname $0)"; pwd)"
PRG="$(basename "$0")"

if ! which npm >/dev/null; then
  echo "npm is required.  http://nodejs.org"
  exit 1
fi

if ! which gem >/dev/null; then
  echo "ruby is required.  http://www.ruby-lang.org"
  exit 1
fi

if ! gem query -i -n sass >/dev/null; then
  echo "The 'sass' ruby gem needs installation. Try:"
  echo "sudy gem install sass"
  exit 1
fi

echo "START_DIR=$START_DIR"
echo "ROOT_DIR=$ROOT_DIR"
echo "PRG=$PRG"

if ! which grunt >/dev/null; then
  echo "The global 'grunt' command needs installation.  Try:"
  echo "sudo npm install -g grunt"
  exit 1
fi

if ! which bower >/dev/null; then
  echo "The global 'bower' command needs installation.  Try:"
  echo "sudo npm install -g bower"
  exit 1
fi

runcmd() {
  # For command printout messages.
  echo "* Running: $1"
  $1 || exit 1
}

echo
echo "### Install local dependencies"
runcmd "cd $ROOT_DIR"
runcmd "npm install"
runcmd "grunt setup"
runcmd "grunt build"
