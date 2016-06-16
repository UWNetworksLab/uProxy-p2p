#!/bin/bash

# Get the directory where this script is and set ROOT_DIR to that path. This
# allows script to be run from different directories but always act on the
# directory of the project (which is where this script is located).
ROOT_DIR="$(cd "$(dirname $0)"; pwd)";
NPM_BIN_DIR="$ROOT_DIR/node_modules/.bin"

# A simple bash script to run commands to setup and install all dev dependencies
# (including non-npm ones)
function runAndAssertCmd ()
{
    echo "Running: $1"
    echo
    # We use set -e to make sure this will fail if the command returns an error
    # code.
    set -e && cd $ROOT_DIR && eval $1
}

# Just run the command, ignore errors (e.g. cp fails if a file already exists
# with "set -e")
function runCmd ()
{
    echo "Running: $1"
    echo
    cd $ROOT_DIR && eval $1
}

function clean ()
{
  runCmd "rm -rf $ROOT_DIR/node_modules $ROOT_DIR/build $ROOT_DIR/.tscache"
}

function installTools ()
{
  runCmd "mkdir -p build/tools"
  runCmd "cp src/lib/build-tools/*.ts build/tools/"
  runAndAssertCmd "$NPM_BIN_DIR/tsc --module commonjs --noImplicitAny ./build/tools/*.ts"
}

function installThirdParty ()
{
  runAndAssertCmd "$NPM_BIN_DIR/bower install --allow-root --config.interactive=false --config.directory=build/third_party/bower"
  runAndAssertCmd "mkdir -p build/third_party"
  runAndAssertCmd "pushd third_party && $NPM_BIN_DIR/typings install && popd"
  runAndAssertCmd "cp -r third_party/* build/third_party/"
  runAndAssertCmd "mkdir -p build/third_party/freedom-port-control"
  runAndAssertCmd "cp -r node_modules/freedom-port-control/dist build/third_party/freedom-port-control/"
}

function installDevDependencies ()
{
  runAndAssertCmd "npm install"
  installThirdParty
  installTools
}

if [ "$1" == 'install' ]; then
  installDevDependencies
elif [ "$1" == 'tools' ]; then
  installTools
elif [ "$1" == 'third_party' ]; then
  installThirdParty
elif [ "$1" == 'clean' ]; then
  clean
else
  echo "Usage: setup.sh [install|tools|third_party|clean]"
  echo "  install       Installs 'node_modules' and 'build/third_party'"
  echo "  tools         Installs build tools into 'build/tools'"
  echo "  third_party   Installs 'build/third_party'"
  echo "  clean         Removes all dependencies installed by this script."
  echo
  exit 0
fi
