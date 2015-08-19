#!/bin/bash

# Runs the SOCKS proxy between two browsers in two docker instances.
# Arguments: two browser-version specs.

# ./run_pair.sh chrome-dev chrome-dev
#  Runs two instances running the dev version of chrome, connects them
#  together, and runs a proxy.

set -e

source "${BASH_SOURCE%/*}/utils.sh" || (echo "cannot find utils.sh" && exit 1)

BRANCH="-b dev"
REPO=
VNC=false
KEEP=false

function usage () {
    echo "$0 [-v] [-k] [-b branch] [-r repo] [-p path] browserspec browserspec"
    echo "  -b BRANCH: have containers check out this BRANCH.  Default is dev."
    echo "  -r REPO: have containers clone this REPO.  "
    echo "           Default is https://github.com/uProxy/uproxy-lib.git."
    echo "  -p: path to pre-built uproxy-lib repository (overrides -b and -r)."
    echo "  -v: enable VNC on containers.  They will be ports 5900 and 5901."
    echo "  -k: KEEP containers after last process exits.  This is docker's --rm."
    echo "  -h, -?: this help message."
    echo
    echo "browserspec is a pair of browser-version."
    echo "  Valid browsers are firefox and chrome, valid versions "
    echo "  stable, beta, and canary, e.g. chrome-stable and firefox-beta."
    exit 1
}

while getopts kvb:r:p:h? opt; do
    case $opt in
        k) KEEP=true ;;
        v) VNC=true ;;
        b) BRANCH="-b $OPTARG" ;;
        r) REPO="-r $OPTARG" ;;
        p) PREBUILT="$OPTARG" ;;
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

if [ "$PREBUILT" ]
then
    RUNARGS="$RUNARGS -p"
else
    RUNARGS="$RUNARGS $REPO $BRANCH"
fi

function make_image () {
    if [ "X$(docker images | tail -n +2 | awk '{print $1}' | /bin/grep uproxy/$1 )" == "Xuproxy/$1" ]
    then
        echo "Reusing existing image uproxy/$1"
    else
        BROWSER=$(echo $1 | cut -d - -f 1)
        VERSION=$(echo $1 | cut -d - -f 2)
        ./image_make.sh $BROWSER $VERSION
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
# TODO: Take a -b BRANCH arg and pass it to load-adventure.sh
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
    docker run $HOSTARGS $@ --name $NAME $(docker_run_args $IMAGENAME) -d $IMAGENAME /test/bin/load-adventure.sh $RUNARGS -w
}

run_docker uproxy-getter $1 $VNCOPTS1 -p 9000:9000 -p 9999:9999
run_docker uproxy-giver $2 $VNCOPTS2 -p 9010:9000

CONTAINER_IP=localhost
if uname|grep Darwin > /dev/null
then
    CONTAINER_IP=`boot2docker ip`
fi

echo -n "Waiting for getter to come up"
while ! ((echo ping ; sleep 0.5) | nc -w 1 $CONTAINER_IP 9000 | grep ping) > /dev/null; do echo -n .; done
echo

echo -n "Waiting for giver to come up"
while ! ((echo ping ; sleep 0.5) | nc -w 1 $CONTAINER_IP 9010 | grep ping) > /dev/null; do echo -n .; done
echo

echo "Connecting pair..."
sleep 2 # make sure nc is shutdown
./connect-pair.py $CONTAINER_IP 9000 $CONTAINER_IP 9010

echo "All done!"
