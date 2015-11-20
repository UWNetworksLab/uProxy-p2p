#!/bin/bash

# Runs a Zork and SSH server, each in their own Docker containers.
# The SSH server may be used to establish a secure tunnel to Zork,
# which is configured to accept connections from localhost.
#
# uProxy's cloud social provider knows how to establish such a tunnel,
# assuming sshd is running on port 5000 and that Zork is accessible
# via the sshd server at zork:9000.

set -e

PREBUILT=
INVITE_CODE=
REFRESH=false
PUBLIC_IP=
BANNER=

SSHD_PORT=5000

function usage () {
  echo "$0 [-p path] [-i invite code] [-r] [-d ip] [-b banner] browser-version"
  echo "  -p: path to pre-built uproxy-lib repository"
  echo "  -i: invite code"
  echo "  -r: recreate Docker images (WARNING: will invalidate invite codes)"
  echo "  -d: override the detected public IP (for development only)"
  echo "  -b: name to use in contacts list"
  echo "  -h, -?: this help message"
  echo
  echo "Example browser-version: chrome-stable, firefox-canary"
  exit 1
}

while getopts p:i:rd:b:h? opt; do
  case $opt in
    p) PREBUILT="$OPTARG" ;;
    i) INVITE_CODE="$OPTARG" ;;
    r) REFRESH=true ;;
    d) PUBLIC_IP="$OPTARG" ;;
    b) BANNER="$OPTARG" ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

if [ $# -lt 1 ]
then
  usage
fi

if [ $REFRESH = true ]
then
  docker rm -f uproxy-sshd || true
  docker rm -f uproxy-zork || true
  docker rmi uproxy/sshd || true
  # TODO: This will fail if there are any containers using the
  #       image, e.g. run_pair.sh. Regular cloud users won't be.
  docker rmi uproxy/$1 || true
fi

# Start Zork, if necessary.
if ! docker ps -a | grep uproxy-zork >/dev/null; then
  if ! docker images | grep uproxy/$1 >/dev/null; then
    BROWSER=$(echo $1 | cut -d - -f 1)
    VERSION=$(echo $1 | cut -d - -f 2)
    ${BASH_SOURCE%/*}/image_make.sh $BROWSER $VERSION
  fi
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
  docker run --restart=always --net=host  $HOSTARGS --name uproxy-zork -d uproxy/$1 /test/bin/load-zork.sh $RUNARGS -w
fi

# Start sshd, if necessary.
if ! docker ps -a | grep uproxy-sshd >/dev/null; then
  if ! docker images | grep uproxy/sshd >/dev/null; then
    TMP_DIR=/tmp/uproxy-sshd
    rm -fR $TMP_DIR
    cp -R ${BASH_SOURCE%/*}/../../sshd/ $TMP_DIR

    echo -n "$BANNER" > $TMP_DIR/banner

    # Optional build args aren't very flexible...confine the messiness here.
    ISSUE_INVITE_ARGS=
    if [ -n "$PUBLIC_IP" ]
    then
      ISSUE_INVITE_ARGS="$ISSUE_INVITE_ARGS -d $PUBLIC_IP"
    fi
    if [ -n "$INVITE_CODE" ]
    then
      ISSUE_INVITE_ARGS="$ISSUE_INVITE_ARGS -i $INVITE_CODE"
    fi
    docker build --build-arg issue_invite_args="$ISSUE_INVITE_ARGS" -t uproxy/sshd $TMP_DIR
  fi

  # Add an /etc/hosts entry to the Zork container.
  # Because the Zork container runs with --net=host, we can't use the
  # regular, ever-so-slightly-more-elegant Docker notation.
  HOST_IP=`ip -o -4 addr list docker0 | awk '{print $4}' | cut -d/ -f1`
  docker run --restart=always -d -p $SSHD_PORT:22 --name uproxy-sshd --add-host zork:$HOST_IP uproxy/sshd > /dev/null

  echo -n "Waiting for Zork to come up..."
  while ! ((echo ping ; sleep 0.5) | nc -w 1 $HOST_IP 9000 | grep ping) > /dev/null; do echo -n .; done
  echo "ready!"

  if [ -z "$INVITE_CODE" ]
  then
    INVITE_CODE=`docker cp uproxy-sshd:/initial-giver-invite-code -|tar xO`
    echo "invite code: $INVITE_CODE"
  fi
fi
