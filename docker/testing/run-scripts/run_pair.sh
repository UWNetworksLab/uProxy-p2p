#!/bin/bash

# Runs the SOCKS proxy between two browsers in two docker instances.
# Arguments: two browser-version specs.

# ./run_pair.sh chrome-dev chrome-dev
#  Runs two instances running the dev version of chrome, connects them
#  together, and runs a proxy.

set -e

source "${BASH_SOURCE%/*}/utils.sh" || (echo "cannot find utils.sh" && exit 1)

PREBUILT=false
VNC=false
KEEP=false
MTU=
LATENCY=
PROXY_PORT=9999
CONTAINER_PREFIX="uproxy"

function usage () {
  echo "$0 [-p] [-v] [-k] [-m mtu] [-l latency] [-s port] [-u prefix] browserspec browserspec"
  echo "  -p: use Zork from this client rather than the Docker image"
  echo "  -v: enable VNC on containers.  They will be ports 5900 and 5901."
  echo "  -k: KEEP containers after last process exits.  This is docker's --rm."
  echo "  -m MTU: set the MTU on the getter's network interface."
  echo "  -l latency: set latency (in ms) on the getter's network interface."
  echo "  -s port: forwarding port for the proxy on the host.  Default is 9999."
  echo "  -u prefix: prefix for getter and giver container names.  Default is uproxy."
  echo "  -h, -?: this help message."
  echo
  echo "browserspec is a pair of browser-version."
  echo "  Valid browsers are firefox and chrome, valid versions "
  echo "  stable, beta, and canary, e.g. chrome-stable and firefox-beta."
  exit 1
}

# TODO: replace browser-version with a Docker image name, ala run_cloud.sh
while getopts pkvr:m:l:s:u:h? opt; do
  case $opt in
    p) PREBUILT=true ;;
    k) KEEP=true ;;
    v) VNC=true ;;
    m) MTU="$OPTARG" ;;
    l) LATENCY="$OPTARG" ;;
    s) PROXY_PORT="$OPTARG" ;;
    u) CONTAINER_PREFIX="$OPTARG" ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

if [ $# -lt 2 ]
then
  usage
fi

if $VNC; then
  VNCOPTS1="-p 5900:5900"
  VNCOPTS2="-p 5901:5900"
  RUNARGS="$RUNARGS -v"
fi

# Kill any running giver and getter containers.
for role in getter giver; do
  if docker ps -a | grep $CONTAINER_PREFIX-$role >/dev/null; then
    echo "Stopping running $CONTAINER_PREFIX-$role..."
    docker rm -f $CONTAINER_PREFIX-$role > /dev/null
  fi
done

# $1 is the name of the resulting container.
# $2 is the image to run, and the rest are flags.
# TODO: Take a -b BRANCH arg and pass it to load-zork.sh
function run_docker () {
  local NAME=$1
  local IMAGE=$2
  shift; shift
  IMAGENAME=uproxy/$IMAGE
  local HOSTARGS=
  if $KEEP
  then
    HOSTARGS="$HOSTARGS --rm=false"
  fi
  if [ "$PREBUILT" = true ]; then
    GIT_ROOT=`git rev-parse --show-toplevel`
    if [[ $IMAGE == *'node'* ]]; then
      HOSTARGS="$HOSTARGS -v $GIT_ROOT:/test/zork"
    else
      HOSTARGS="$HOSTARGS -v $GIT_ROOT/build/src/lib/samples:/test/zork"
    fi
  fi
  docker run $HOSTARGS $@ --name $NAME $(docker_run_args $IMAGENAME) -d $IMAGENAME /test/bin/load-zork.sh $RUNARGS
}

run_docker $CONTAINER_PREFIX-getter $1 $VNCOPTS1 -p :9000 -p $PROXY_PORT:9999
run_docker $CONTAINER_PREFIX-giver $2 $VNCOPTS2 -p :9000

GETTER_COMMAND_PORT=`docker port $CONTAINER_PREFIX-getter 9000|cut -d':' -f2`
GIVER_COMMAND_PORT=`docker port $CONTAINER_PREFIX-giver 9000|cut -d':' -f2`

echo -n "Waiting for getter to come up"
while ! ((echo ping ; sleep 0.5) | nc -w 1 localhost $GETTER_COMMAND_PORT | grep ping) > /dev/null; do echo -n .; done
echo

if [ -n "$MTU" ]
then
  ${BASH_SOURCE%/*}/set-mtu.sh $CONTAINER_PREFIX-getter $MTU
fi

if [ -n "$LATENCY" ]
then
  ${BASH_SOURCE%/*}/set-latency.sh $CONTAINER_PREFIX-getter qdisc add dev eth0 root netem delay "$LATENCY"ms
fi

echo -n "Waiting for giver to come up"
while ! ((echo ping ; sleep 0.5) | nc -w 1 localhost $GIVER_COMMAND_PORT | grep ping) > /dev/null; do echo -n .; done
echo

echo "Connecting pair..."
sleep 2 # make sure nc is shutdown
${BASH_SOURCE%/*}/connect-pair.py localhost $GETTER_COMMAND_PORT localhost $GIVER_COMMAND_PORT

echo "SOCKS proxy should be available, sample command:"
echo "  curl -x socks5h://localhost:$PROXY_PORT www.example.com"
