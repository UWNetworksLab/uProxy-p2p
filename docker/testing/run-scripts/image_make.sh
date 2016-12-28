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
FROM phusion/baseimage:0.9.19

RUN apt-get -qq update
RUN apt-get -qq --fix-missing install wget unzip bzip2 supervisor iptables unattended-upgrades

RUN mkdir /test
COPY test /test

EXPOSE 9000
EXPOSE 9999
EOF

# Chrome and Firefox need X.
if [ "$BROWSER" = "chrome" ] || [ "$BROWSER" = "firefox" ]; then
  cat <<EOF >> $TMP_DIR/Dockerfile
RUN apt-get install -y xvfb fvwm x11vnc
EXPOSE 5900
EOF
fi

mkdir $TMP_DIR/zork
cp -R $GIT_ROOT/build/src/lib/samples/zork-* $TMP_DIR/zork
cat <<EOF >> $TMP_DIR/Dockerfile
COPY zork /test/zork/
EOF

${BASH_SOURCE%/*}/gen_browser.sh "$@" >> $TMP_DIR/Dockerfile

# TODO: remove dborkan before merging
docker build -t dborkan/$BROWSER-$VERSION $TMP_DIR
