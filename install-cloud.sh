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
  curl -fsSL https://get.docker.com/ | sh
  service docker start
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
