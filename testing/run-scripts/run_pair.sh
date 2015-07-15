#!/bin/bash

# Runs the SOCKS proxy between two browsers in two docker instances.
# Arguments: two browser-version specs.

# ./run_pair.sh chrome-dev chrome-dev
#  Runs two instances running the dev version of chrome, connects them
#  together, and runs a proxy.

# TODO: put in honest arg mapping.

BRANCH="-b dev"
REPO=
VNC=false
KEEP=false

function usage () {
    echo "$0 [-v] [-k] [-b branch] [-r repo] browserspec browserspec"
    echo "  -b BRANCH: have containers check out this BRANCH.  Default is dev."
    echo "  -r REPO: have containers clone this REPO.  "
    echo "           Default is https://github.com/uProxy/uproxy-lib.git."
    echo "  -v: enable VNC on containers.  They will be ports 5900 and 5901."
    echo "  -k: KEEP containers after last process exits.  This is docker's --rm."
    echo "  -h, -?: this help message."
    echo
    echo " browserspec is a pair of browser and version. Valid browsers are firefox and chrome."
    echo "   Valid versions depend on the browser.  These are valid pairs:"
    echo "     chrome-dev, chrome-rel, chrome-canary,"
    echo "     firefox-aur, firefox-beta, firefox-rel"
    exit 1
}

while getopts kvb:r:h? opt; do
    case $opt in
        k) KEEP=true ;;
        v) VNC=true ;;
        b) BRANCH="-b $OPTARG" ;;
        r) REPO="-r $OPTARG" ;;
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

function make_image () {
    if docker images | grep uproxy/$1 >/dev/null
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
    # echo "run_docker " $*
    HOSTARGS=
    # "--add-host stun1.l.google.com:0.0.0.0 --add-host stun.l.google.com:0.0.0.0"
    NAME=$1
    IMAGE=$2
    IMAGENAME=uproxy/$IMAGE
    shift; shift
    if $KEEP
    then
        HOSTARGS="$HOSTARGS --rm=false"
    else
        HOSTARGS="$HOSTARGS"
    fi
    docker run $HOSTARGS $* --name $NAME -d $IMAGENAME /test/bin/load-adventure.sh $REPO $BRANCH $RUNARGS -w
}

run_docker uproxy-getter $1 $VNCOPTS1 -p 9000:9000 -p 9999:9999
run_docker uproxy-giver $2 $VNCOPTS2 -p 9010:9000

echo -n "Waiting for getter to come up"
while ! (echo ping | nc -q 1 localhost 9000 | grep ping) > /dev/null; do echo -n .; sleep 0.5; done
echo

echo -n "Waiting for giver to come up"
while ! (echo ping | nc -q 1 localhost 9010 | grep ping) > /dev/null; do echo -n .; sleep 0.5; done
echo

echo "Connecting pair..."
sleep 2 # make sure nc is shutdown
./connect-pair.py

echo "All done!"
