#!/bin/bash

set -e

GIT=false
BRANCH=
PREBUILT=false

function usage () {
  echo "$0 [-g] [-b branch] [-p] [-h] browser version"
  echo "  -g: pull code from git (conflicts with -p)"
  echo "  -b: git branch to pull (default: HEAD's referant)"
  echo "  -p: use a pre-built uproxy-lib (conflicts with -g)"
  echo "  -h, -?: this help message"
  echo
  echo "Without -g or -p the latest uproxy-lib NPM will be run."
  exit 1;
}

while getopts gb:ph? opt; do
  case $opt in
    g) GIT=true ;;
    b) BRANCH="-b $OPTARG" ;;
    p) PREBUILT=true ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

if [ "$GIT" = true ] && [ "$PREBUILT" = true ]
then
  echo "cannot use both -g and -p"
  usage
fi

if [ -n "$BRANCH" ] && [ "$GIT" = false ]
then
  echo "-g must be used when -b is used"
  usage
fi

if [ $# -lt 2 ]
then
  usage
fi

BROWSER=$1
VERSION=$2

TMP_DIR=`mktemp -d`

cp -R ${BASH_SOURCE%/*}/../integration/test $TMP_DIR/test

cat <<EOF > $TMP_DIR/Dockerfile
FROM phusion/baseimage:0.9.18

RUN apt-get -qq update
RUN apt-get -qq install wget unzip xvfb fvwm supervisor iptables x11vnc

RUN mkdir /test
COPY test /test

EXPOSE 9000
EXPOSE 9999
EXPOSE 5900
EOF

# load-zork.sh needs a copy of Zork in:
#   /test/src/uproxy-lib/build/dist/samples/zork-{chrome|firefox}app.
# Unless -p was specified, we need to pull it down.
if [ "$GIT" = true ]
then
  cat <<EOF >> $TMP_DIR/Dockerfile
RUN apt-get -qq install git nodejs npm
RUN ln -s /usr/bin/nodejs /usr/bin/node
RUN npm install -g grunt-cli
RUN mkdir -p /test/src && cd /test/src && git clone https://github.com/uProxy/uproxy-lib.git $BRANCH
RUN cd /test/src/uproxy-lib && ./setup.sh install && grunt zork
EOF
elif [ "$PREBUILT" = false ]
then
  cat <<EOF >> $TMP_DIR/Dockerfile
RUN apt-get -qq install npm
RUN npm install --prefix /test/src uproxy-lib
RUN ln -s /test/src/node_modules/uproxy-lib /test/src/uproxy-lib
EOF
fi

./gen_browser.sh "$@" >> $TMP_DIR/Dockerfile

docker build -t uproxy/$BROWSER-$VERSION $TMP_DIR
