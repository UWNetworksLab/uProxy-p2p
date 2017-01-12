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

REQUIRED_COMMANDS="docker git nc"

AUTOMATED=false
KEY=
UPDATE=false
BRANCH=
PUBLIC_IP=
ZORK_IMAGE=
SSHD_IMAGE=

usage() {
  echo "$0 [-a] [-k key] [-u] [-d ip] [-z zork_image] [-s sshd_image] [-b branch] [-h]"
  echo "  -a: do not output complete invite URL"
  echo "  -k: public key, base64 encoded (if unspecified, a new invite code is generated)"
  echo "  -u: update Docker images (preserves invites and metadata)"
  echo "  -d: override the detected public IP (for development only)"
  echo "  -z: override default Zork image"
  echo "  -s: override default sshd image"
  echo "  -b: github branch from which to run setup scripts"
  echo "  -h, -?: this help message"
  exit 1
}

while getopts k:aud:z:s:b:h? opt; do
  case $opt in
    a) AUTOMATED=true ;;
    k) KEY="$OPTARG" ;;
    u) UPDATE=true ;;
    d) PUBLIC_IP="$OPTARG" ;;
    s) SSHD_IMAGE="$OPTARG" ;;
    z) ZORK_IMAGE="$OPTARG" ;;
    b) BRANCH="$OPTARG" ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

command_exists() {
  command -v "$@" > /dev/null 2>&1
}

show_deps() {
  echo "This script depends on the following commands: $REQUIRED_COMMANDS"
  echo "Please install them before running this script. Instructions"
  echo "for installing Docker can be found here:"
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
  # We depend on --build-arg, introduced in Docker 1.9.
  # Some distros are really slow to update.
  if [ `docker version --format '{{.Server.Version}}' | cut -d . -f 2` -lt 9 ]
  then
    echo "Before running this script, please upgrade Docker to version 1.9 or"
    echo "greater. If you have containers or images you wish to use afterwards,"
    echo "read this page first:"
    echo "  https://github.com/docker/docker/wiki/Engine-v1.10.0-content-addressability-migration"
    exit 1
  fi

  for dep in $REQUIRED_COMMANDS
  do
    if ! command_exists $dep
    then
      show_deps
    fi
  done

  echo "CLOUD_INSTALL_STATUS_DOWNLOADING_INSTALL_SCRIPTS"
  TMP_DIR=`mktemp -d`
  GIT_CLONE_ARGS=
  if [ -n "$BRANCH" ]
  then
    GIT_CLONE_ARGS="$GIT_CLONE_ARGS -b $BRANCH"
  fi
  git clone --depth 1 $GIT_CLONE_ARGS https://github.com/uProxy/uproxy.git $TMP_DIR

  RUN_CLOUD_ARGS=
  if [ "$AUTOMATED" = true ]
  then
    RUN_CLOUD_ARGS="$RUN_CLOUD_ARGS -a"
  fi
  if [ "$UPDATE" = true ]
  then
    RUN_CLOUD_ARGS="$RUN_CLOUD_ARGS -u"
  fi
  if [ -n "$KEY" ]
  then
    RUN_CLOUD_ARGS="$RUN_CLOUD_ARGS -k $KEY"
  fi
  if [ -n "$PUBLIC_IP" ]
  then
    RUN_CLOUD_ARGS="$RUN_CLOUD_ARGS -d $PUBLIC_IP"
  fi
  if [ -n "$ZORK_IMAGE" ]
  then
    RUN_CLOUD_ARGS="$RUN_CLOUD_ARGS -z $ZORK_IMAGE"
  fi
  if [ -n "$SSHD_IMAGE" ]
  then
    RUN_CLOUD_ARGS="$RUN_CLOUD_ARGS -s $SSHD_IMAGE"
  fi
  $TMP_DIR/docker/testing/run-scripts/run_cloud.sh $RUN_CLOUD_ARGS
}

# Wrapped in a function for some protection against half-downloads.
do_install
