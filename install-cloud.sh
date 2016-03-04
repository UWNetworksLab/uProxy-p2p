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

if [ -f /etc/centos-release ]
then 
  yum update -y
  yum install -y git bind-utils nmap-ncat
  if [ ! -f /usr/bin/docker ]
  then
    curl -fsSL https://get.docker.com/ | sh
    service docker start
  elif [ -f /usr/bin/docker -a $(( $(docker --version | cut -d . -f 2) < 10 )) ]
  then
    echo "Installed version of docker is too old.  Please upgrade it yourself, or remove"
    echo "it (yum erase docker) and run this script again.  If you don't have other"
    echo "docker containers/images, removing it is fine, this script can do the rest. If"
    echo "you do have other docker containers/images, have a look here:"
    echo " https://github.com/docker/docker/wiki/Engine-v1.10.0-content-addressability-migration"
    echo "first, and then upgrade docker yourself before running this script again."
    exit 1
  fi
fi

do_install() {
  TMP_DIR=`mktemp -d`
  git clone --depth 1 https://github.com/uProxy/uproxy-docker.git $TMP_DIR
  cd $TMP_DIR/testing/run-scripts

   # TODO: pass arguments, e.g. banner
  ./run_cloud.sh firefox-stable
}

# Wrapped in a function for some protection against half-downloads.
do_install
