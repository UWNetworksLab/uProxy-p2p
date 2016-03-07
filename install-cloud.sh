#!/bin/sh

# Quick and easy install via curl and wget.
# 
# All of the heavy lifting is done by run_cloud.sh: this
# script just clones the uproxy-docker repo and executes
# run_cloud.sh from there.
#
# Heavily based on Docker's installer at:
#   https://get.docker.com/.

set -e

command_exists() {
  command -v "$@" > /dev/null 2>&1
}

show_deps() {
  echo "Before running this script, please install git, nc, and Docker."
  echo "Installation instructions for Docker can be found here:"
  echo "  https://docs.docker.com/mac/started/"
  exit 1
}

do_install() {
  # Since we cannot currently use DigitalOcean's Docker slug, install Docker
  # if necessary. We also run a few other dependency checks to help those
  # running on unsupported systems. Note that git is *not* present by default
  # on DigitalOcean's Ubuntu 14.04 image: Docker's installer installs it. This
  # is why we check for Docker first, even though it may seem cleaner to test
  # for lighter-weight dependencies first.
  if ! command_exists docker
  then
    if [ "$USER" != "root" ]
    then
      show_deps
    fi
    echo "Docker not found, running Docker installer."
    curl -fsSL https://get.docker.com/ | sh
  fi
  for dep in git nc
  do
    if ! command_exists $dep
    then
      show_deps
    fi
  done

  TMP_DIR=`mktemp -d`
  git clone --depth 1 https://github.com/uProxy/uproxy-docker.git $TMP_DIR
  cd $TMP_DIR/testing/run-scripts

   # TODO: pass arguments, e.g. banner
  ./run_cloud.sh firefox-stable
}

# Wrapped in a function for some protection against half-downloads.
do_install
