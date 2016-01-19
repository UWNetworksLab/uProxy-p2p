#!/bin/bash

. /etc/test.conf

RUNVNC=false
FOREVER=false
LISTEN=false
CLONEARGS=
CLONESRC=https://github.com/uProxy/uproxy-lib.git
PREBUILT=false
while getopts b:r:lpvh? opt; do
    case $opt in
        b)
            CLONEARGS="$CLONEARGS -b $OPTARG"
            ;;
        r)
            CLONESRC=$OPTARG
            ;;
        p)
            PREBUILT=true
            ;;
        n)
            NPM=true
            ;;
        v)
            RUNVNC=true
            ;;
        l)
            LISTEN=true
            ;;
        *)
            echo "$0 [-v] [-w] [-l] [-b branch] [-r repo]"
            echo "  -b: BRANCH is the branch to checkout instead of HEAD's referant."
            echo "  -r: REPO is the repository to clone instead of github.com/uProxy/uproxy-lib."
            echo "  -p: use a pre-built uproxy-lib repo (overrides -b and -r)."
            echo "  -n: install uproxy-lib from npm (overrides -b, -r, and -p)"
            echo "  -v: run a vncserver (port 5900 in the instance)"
            echo "  -l: wait until the extension is listening."
            exit 1;
            ;;
    esac
done


# Overlap X startup with our download and build.
export DISPLAY=:10
Xvfb :10 -screen 0 1280x1024x24 &
fvwm &

if $RUNVNC; then
    x11vnc -display :10 -forever &
fi

if [[! $PREBUILT ]] || $NPM; then
    mkdir -p /test/src
    cd /test/src
    npm install -g bower grunt-cli
    if $NPM; then
        npm install uproxy-lib
        cp -r node_modules/uproxy-lib .
        cd uproxy-lib
    elif ! $PREBUILT; then
        echo git clone $CLONEARGS $CLONESRC
        git clone $CLONEARGS $CLONESRC
        cd uproxy-lib
        ./setup.sh install
    fi
    grunt zork
fi

/usr/bin/supervisord -n -c /test/etc/supervisord-$BROWSER.conf
