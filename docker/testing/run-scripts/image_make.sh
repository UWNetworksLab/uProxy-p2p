#!/bin/bash

# Packages Zork in a Docker image.
# There are several choices for runtime environment.
# This script will bundle whatever Zork it finds in the
# client; this may be overridden at runtime with
# run_pair.sh's and run_cloud.sh's -p option.

set -e

# TODO: rename browser -> platform

function usage () {
  echo "$0 [-h] browser version"
  echo "  -h, -?: this help message"
  exit 1;
}

while getopts h? opt; do
  case $opt in
    *) usage ;;
  esac
done
shift $((OPTIND-1))

if [ $# -lt 2 ]; then
  usage
fi

BROWSER=$1
VERSION=$2
readonly GIT_ROOT=`git rev-parse --show-toplevel`

TMP_DIR=`mktemp -d`

cp -R ${BASH_SOURCE%/*}/../integration/test $TMP_DIR/test

cat <<EOF > $TMP_DIR/Dockerfile
FROM ubuntu:yakkety

RUN apt-get -qq update
RUN apt-get -qq install wget unzip bzip2 supervisor iptables unattended-upgrades curl

RUN mkdir /test
COPY test /test

EXPOSE 9000
EXPOSE 9999
EOF

mkdir $TMP_DIR/zork

# Chrome and Firefox need X.
if [ "$BROWSER" = "chrome" ] || [ "$BROWSER" = "firefox" ]; then
  cat <<EOF >> $TMP_DIR/Dockerfile
RUN apt-get install -y xvfb fvwm x11vnc
EXPOSE 5900
EOF

  cp -R $GIT_ROOT/build/src/lib/samples/zork-* $TMP_DIR/zork
fi

# Node needs the whole src/ folder to resolve dependencies (no browserify).
if [ "$BROWSER" = "node" ]; then
  # TODO: Copying the whole node_modules is crazy: it's >500MB.
  #       We should sort out ourn dev/runtime dependencies and
  #       only package the runtime deps (yarn --production --ignore-scripts).
  cp -RL $GIT_ROOT/{build,node_modules} $TMP_DIR/zork/
fi

cat <<EOF >> $TMP_DIR/Dockerfile
COPY zork /test/zork/
EOF

${BASH_SOURCE%/*}/gen_browser.sh "$@" >> $TMP_DIR/Dockerfile

docker build -t uproxy/$BROWSER-$VERSION $TMP_DIR
