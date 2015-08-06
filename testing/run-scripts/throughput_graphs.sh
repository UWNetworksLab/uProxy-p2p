#!/bin/bash

# Calculates the average throughput for downloading a large-ish
# file via the SOCKS proxy.

set -e

FLOOD_SIZE_MB=25
FLOOD_MAX_SPEED=5M

function usage () {
    echo "$0 path"
    echo "  path is the path to a pre-built uproxy-lib repo"
    exit 1
}

if [ $# -lt 1 ]
then
    usage
fi

source "${BASH_SOURCE%/*}/utils.sh" || (echo "cannot find utils.sh" && exit 1)

# Where is flood server?
# We may need to start one, building an image if necessary.
if ! docker ps | grep uproxy-flood >/dev/null; then
  if ! docker images | grep uproxy/flood >/dev/null; then
    log "building flood server image..."
    docker build -t uproxy/flood ${BASH_SOURCE%/*}/../../flood
  fi
  log "starting flood server..."
  docker run -d -p 1224:1224 --name uproxy-flood uproxy/flood "$FLOOD_SIZE_MB"M $FLOOD_MAX_SPEED
fi
FLOOD_IP=`docker inspect --format '{{ .NetworkSettings.IPAddress }}' uproxy-flood`
log "using flood server at $FLOOD_IP"

for browser in chrome firefox
do
  for ver in stable beta canary
  do
    log "benchmarking $browser $ver..."

    for role in getter giver
    do
      if docker ps | grep uproxy-$role >/dev/null; then
        log "stopping existing uproxy-$role..."
        docker rm -f uproxy-$role > /dev/null
      fi
    done

    pushd ${BASH_SOURCE%/*} > /dev/null
    ./run_pair.sh -p $1 $browser-$ver $browser-$ver
    popd > /dev/null

    # TODO: make this work on Mac...approximate code below
    # if uname|grep Darwin > /dev/null
    #   time -p (ncat -i 1 --proxy-type socks5 --proxy `boot2docker ip`:9999 $HOST_IP 1224 >/dev/null) 2>&1) > /tmp/compare
    #   ELAPSED_SEC=`grep real /tmp/compare|cut -d' ' -f2`

    /usr/bin/time -f %e --output /tmp/compare nc -X 5 -x localhost:9999 $FLOOD_IP 1224
    ELAPSED_SEC=`cat /tmp/compare`
    MB_PER_SEC=`echo "$(($FLOOD_SIZE_MB * 1024)) / $ELAPSED_SEC"|bc`
    log "throughput (K/sec) for $browser $ver: $MB_PER_SEC"
  done
done

# TODO: output a Google Charts API URL
