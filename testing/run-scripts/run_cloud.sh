#!/bin/bash

# Runs Zork along with an SSH server.

set -e

source "${BASH_SOURCE%/*}/utils.sh" || (echo "cannot find utils.sh" && exit 1)

PREBUILT=
SSHD_PORT=5000
CONTAINER_PREFIX="uproxy"
# Users testing on a LAN will want to override this with their
# internal, non-routable IP (or, more simply, "localhost").
# Everyone else will want their public, external, routable IP.
# This beautiful, cross-platform one-liner gives us this.
# Cogged from:
#   http://unix.stackexchange.com/questions/22615/how-can-i-get-my-external-ip-address-in-bash
CLOUD_IP=`dig +short myip.opendns.com @resolver1.opendns.com`

function usage () {
  echo "$0 [-p path] [-h hostname] browser-version"
  echo "  -p: path to pre-built uproxy-lib repository"
  echo "  -i: IP or hostname of the cloud instance"
  echo "  -h, -?: this help message"
  echo
  echo "Example browser-version: chrome-stable, firefox-canary"
  exit 1
}

while getopts p:i:h? opt; do
  case $opt in
    p) PREBUILT="$OPTARG" ;;
    i) CLOUD_IP="$OPTARG" ;;
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
# If there is no image, bootstrap an invite code and build one.
if [ "X$(docker images | tail -n +2 | awk '{print $1}' | grep uproxy/sshd )X" == "Xuproxy/sshdX" ]
then
  echo "$CONTAINER_PREFIX-sshd image already exists, re-using"
else
  TMP_DIR=/tmp/uproxy-sshd
  rm -fR $TMP_DIR
  cp -R ${BASH_SOURCE%/*}/../../sshd/ $TMP_DIR

  # 21 characters leaves no = at the end, which is generally easier to double click.
  GIVER_PW=`openssl rand -base64 21`
  echo -n $GIVER_PW > $TMP_DIR/giverpw
  docker build -t uproxy/sshd $TMP_DIR

  # TODO: invoke a script on the container, duplicating this code is dumb. 
  UNENCODED_TOKEN="{\"host\":\"$CLOUD_IP\", \"user\":\"giver\", \"pass\":\"$GIVER_PW\"}"
  if uname|grep Darwin > /dev/null
  then
    ENCODED_TOKEN=`echo -n $UNENCODED_TOKEN|base64`
  else
    ENCODED_TOKEN=`echo -n $UNENCODED_TOKEN|base64 -w 0`
  fi
  echo "password, for shell access: $GIVER_PW"
  echo "invite code, for uProxy: $ENCODED_TOKEN"
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
echo "Connect with:"
echo "  telnet $HOST_IP 9000"
