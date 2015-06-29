#!/bin/bash

# Runs copy-paste between two browsers in two docker instances.
# Arguments: two browser-version specs.

# ./run_copypaste chrome-dev chrome-dev
#  Runs two instances running the dev version of chrome, connects them
#  together, and runs a proxy.

if [ $# -lt 2 ]
then
    echo "usage: browserspec browserspec, where each is in the format 'browser-version'"
    echo "    examples: chrome-dev firefox-beta, etc."
    exit 1
fi

KEEP=false

if [ $1 == "--keep" ]
then
    KEEP=true
    shift
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
# TODO: Take a -b BRANCH arg and pass it to load-copypaste.sh
function run_docker () {
    echo "run_docker " $*
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
    sudo docker run $HOSTARGS $* --name $NAME -d $IMAGENAME /test/bin/load-copypaste.sh -b dev -v -w
}

run_docker copypaste-getter $1 -p 5900:5900 -p 9000:9000 -p 9999:9999
run_docker copypaste-giver $2 -p 5901:5900 -p 9010:9000 -p 9998:9999

echo "Waiting 2 minutes, as it'll take at least that long."
sleep 120

echo -n "Waiting for control port 9000 to come up"
while netstat -lt | grep 9000 >/dev/null; do echo -n .;  sleep 1; done
echo

echo -n "Waiting for control port 9010 to come up"
while netstat -lt | grep 9010 >/dev/null; do echo -n .;  sleep 1; done
echo

./connect-pair.py
