#!/bin/bash

#
# Utility functions invoked by other scripts.
#

# i.e., a good place to hide hacks.

# Prints its arguments to stdout.
function log () {
  echo $@ >&2
}

# Sets CHROMEDIRPATH to the path of the locally-built chrome binaries.
# $1 is the name of the version.  Debug or Release.  Contains logic to
# find the full chrome build path.  Exits with error if not found.
function chrome_build_path () {
  local CHROMEDIRPATH=${CHROME_BUILD_DIR:-`pwd`}/out/$1
  if [ ! -d $CHROMEDIRPATH ]
  then
    log "$CHROMEDIRPATH does not exist.  Aborting. Try setting CHROME_BUILD_DIR to your src directory."
    exit 1
  fi
  echo $CHROMEDIRPATH
}


# Returns additional arguments to pass to docker run.
#   $1 is the name of the image to run.
#
# Contains logic to look for 'localchrome' and, if found, add a mount
# of the chrome build directory.  Assumes the image name is in
# uproxy/browser-version format.
function docker_run_args () {
  local FULL_IMAGE_NAME=$1
  shift
  local IMAGE=$(echo $FULL_IMAGE_NAME | cut -d / -f 2)
  local BROWSER=$(echo $IMAGE | cut -d - -f 1)
  local VERSION=$(echo $IMAGE | cut -d - -f 2)
  local RUNARGS=
  if [ "x$BROWSER" == "xlocalchrome" ]
  then
    local CPATH=
    if [ "x$VERSION" == "xrelease" ]
    then
      CPATH=$(chrome_build_path Release)
    else
      CPATH=$(chrome_build_path Debug)
    fi
    RUNARGS="$RUNARGS -v ${CPATH}:/test/chrome"
  fi
  echo $RUNARGS
}

function prepare_docker_pid () {
  pid=$(docker inspect -f '{{.State.Pid}}' $1)
  if [ ! -L /var/run/netns/$pid ]
  then
    echo "[Making network namespace for $pid accessible]"
    sudo mkdir -p /var/run/netns
    sudo ln -s /proc/$pid/ns/net /var/run/netns/$pid
    echo "[Created /var/run/netns $pid]"
  fi
}


# Given a docker container ID in $1, returns a PID for it.
function docker_pid () {
  docker inspect -f '{{.State.Pid}}' $1
}

