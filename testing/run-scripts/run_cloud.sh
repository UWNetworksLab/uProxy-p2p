#!/bin/bash

# Runs Zork along with an SSH server.

set -e

source "${BASH_SOURCE%/*}/utils.sh" || (echo "cannot find utils.sh" && exit 1)

PREBUILT=
SSHD_PORT=5000
CONTAINER_PREFIX="uproxy"

function usage () {
  echo "$0 [-p path] browser-version"
  echo "  -p: path to pre-built uproxy-lib repository"
  echo "  -h, -?: this help message"
  echo
  echo "Example browser-version: chrome-stable, firefox-canary"
  exit 1
}

while getopts p:h? opt; do
  case $opt in
    p) PREBUILT="$OPTARG" ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

if [ $# -lt 1 ]
then
  usage
fi

function remove_container () {
  if [ "X$(docker ps -a | tail -n +2 | awk '{print $NF}' | grep $CONTAINER_PREFIX-$1 )X" == "X$CONTAINER_PREFIX-$1X" ]
  then
    echo "Removing old $CONTAINER_PREFIX-$1 container..."
    docker rm -f $CONTAINER_PREFIX-$1 > /dev/null
  fi
}

# Build an image for Zork, if necessary.
if [ "X$(docker images | tail -n +2 | awk '{print $1}' | grep uproxy/$1 )X" == "Xuproxy/$1X" ]
then
  echo "uproxy/$1 image already exists, re-using"
else
    BROWSER=$(echo $1 | cut -d - -f 1)
    VERSION=$(echo $1 | cut -d - -f 2)
    ./image_make.sh $BROWSER $VERSION
fi

# Figure out the args for Zork and start it inside a new container.
HOSTARGS=
if [ ! -z "$PREBUILT" ]
then
  HOSTARGS="$HOSTARGS -v $PREBUILT:/test/src/uproxy-lib"
fi

RUNARGS=
if [ ! -z "$PREBUILT" ]
then
    RUNARGS="$RUNARGS -p"
fi

remove_container cloud
docker run --net=host $HOSTARGS --name $CONTAINER_PREFIX-cloud -d uproxy/$1 /test/bin/load-zork.sh $RUNARGS -w > /dev/null

# Start a container for sshd, linked with Zork's.
if [ "X$(docker images | tail -n +2 | awk '{print $1}' | grep uproxy/sshd )X" == "Xuproxy/sshdX" ]
then
  echo "$CONTAINER_PREFIX-sshd image already exists, re-using"
else
  docker build -t uproxy/sshd ${BASH_SOURCE%/*}/../../sshd
fi
remove_container sshd

HOST_IP=
if uname|grep Darwin > /dev/null
then
  HOST_IP=`docker-machine ip default`
else
  HOST_IP=`ip -o -4 addr list docker0 | awk '{print $4}' | cut -d/ -f1`
fi
docker run -d -p $SSHD_PORT:22 --name $CONTAINER_PREFIX-sshd --add-host zork:$HOST_IP uproxy/sshd > /dev/null

# Happy, reassuring message.
echo -n "Waiting for Zork to come up"
while ! ((echo ping ; sleep 0.5) | nc -w 1 $HOST_IP 9000 | grep ping) > /dev/null; do echo -n .; done
echo "ready!"
