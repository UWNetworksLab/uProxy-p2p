#!/bin/bash

# Runs the SOCKS proxy between two browsers in two docker instances.
# Arguments: two browser-version specs.

# ./run_pair.sh chrome-dev chrome-dev
#  Runs two instances running the dev version of chrome, connects them
#  together, and runs a proxy.

set -e

source "${BASH_SOURCE%/*}/utils.sh" || (echo "cannot find utils.sh" && exit 1)

GIT=false
BRANCH=
PREBUILT=
VNC=false
KEEP=false
MTU=
LATENCY=
PROXY_PORT=9999
CONTAINER_PREFIX="uproxy"

function usage () {
  echo "$0 [-g] [-b branch] [-p path] [-v] [-k] [-m mtu] [-l latency] [-s port] [-u prefix] browserspec browserspec"
  echo "  -g: pull code from git (conflicts with -p)"
  echo "  -b: git branch to pull (default: HEAD's referant)"
  echo "  -p: use a pre-built uproxy-lib (conflicts with -g)"
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

while getopts gb:p:kvr:m:l:s:u:h? opt; do
  case $opt in
    g) GIT=true ;;
    b) BRANCH="$OPTARG" ;;
    p) PREBUILT="$OPTARG" ;;
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

function make_image () {
  if [ "X$(docker images | tail -n +2 | awk '{print $1}' | grep uproxy/$1 )" == "Xuproxy/$1" ]
  then
    echo "Reusing existing image uproxy/$1"
  else
    BROWSER=$(echo $1 | cut -d - -f 1)
    VERSION=$(echo $1 | cut -d - -f 2)
    IMAGEARGS=
    if [ -n "$PREBUILT" ]
    then
      IMAGEARGS="-p"
    elif [ "$GIT" = true ]
    then
      IMAGEARGS="-g -b $BRANCH"
    fi
    ./image_make.sh $IMAGEARGS $BROWSER $VERSION
  fi
}

if ! make_image $1
then
  echo "FAILED: Could not make docker image for $1."
  exit 1
fi

if ! make_image $2
then
  echo "FAILED: Could not make docker image for $2."
  exit 1
fi

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
  if [ ! -z "$PREBUILT" ]
  then
    HOSTARGS="$HOSTARGS -v $PREBUILT:/test/src/uproxy-lib"
  fi
  docker run $HOSTARGS $@ --name $NAME $(docker_run_args $IMAGENAME) -d $IMAGENAME /test/bin/load-zork.sh $RUNARGS
}

run_docker $CONTAINER_PREFIX-getter $1 $VNCOPTS1 -p :9000 -p $PROXY_PORT:9999
run_docker $CONTAINER_PREFIX-giver $2 $VNCOPTS2 -p :9000

CONTAINER_IP=localhost
if uname|grep Darwin > /dev/null
then
  CONTAINER_IP=`docker-machine ip default`
fi

GETTER_COMMAND_PORT=`docker port $CONTAINER_PREFIX-getter 9000|cut -d':' -f2`
GIVER_COMMAND_PORT=`docker port $CONTAINER_PREFIX-giver 9000|cut -d':' -f2`

echo -n "Waiting for getter to come up"
while ! ((echo ping ; sleep 0.5) | nc -w 1 $CONTAINER_IP $GETTER_COMMAND_PORT | grep ping) > /dev/null; do echo -n .; done
echo

if [ -n "$MTU" ]
then
  ./set-mtu.sh $CONTAINER_PREFIX-getter $MTU
fi

if [ -n "$LATENCY" ]
then
  ./set-latency.sh $CONTAINER_PREFIX-getter qdisc add dev eth0 root netem delay "$LATENCY"ms
fi

echo -n "Waiting for giver to come up"
while ! ((echo ping ; sleep 0.5) | nc -w 1 $CONTAINER_IP $GIVER_COMMAND_PORT | grep ping) > /dev/null; do echo -n .; done
echo

echo "Connecting pair..."
sleep 2 # make sure nc is shutdown
./connect-pair.py $CONTAINER_IP $GETTER_COMMAND_PORT $CONTAINER_IP $GIVER_COMMAND_PORT

echo "SOCKS proxy should be available, sample command:"
echo "  curl -x socks5h://$CONTAINER_IP:$PROXY_PORT www.example.com"
