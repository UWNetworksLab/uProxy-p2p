#!/bin/bash

# Loads the copy-paste example app.
CLONEARGS=
CLONESRC=https://github.com/uProxy/uproxy-lib.git
while getopts b:r:h? opt; do
    case $opt in
        b)
            CLONEARGS="$CLONEARGS -b $OPTARG"
            ;;
        r)
            CLONESRC=$OPTARG
            ;;
        *)
            echo "$0 [-b branch] [-r repo]"
            echo "  -b: BRANCH is the branch to checkout instead of HEAD's referant."
            echo "  -r: REPO is the repository to clone instead of github.com/uProxy/uproxy-lib."
            exit 1;
            ;;
    esac
done


# Overlap X startup with our download and build.
export DISPLAY=:10
Xvfb :10 -screen 0 1280x1024x24 &
fvwm &

mkdir -p /test/src
cd /test/src
npm install -g bower grunt-cli
git clone $CLONEARGS $CLONESRC
cd uproxy-lib
./setup.sh install
grunt
grunt samples

mkdir /tmp/chrome-data

google-chrome --user-data-dir=/tmp/chrome-data --load-and-launch-app=/test/src/uproxy-lib/build/dev/uproxy-lib/samples/copypaste-socks-chromeapp --no-default-browser-check --no-first-run >/dev/null 2>&1 &

# Wait for the control port (9000) to open.
echo -n "Waiting for control port to come up"
while ! netstat -lt | grep 9000 >/dev/null; do echo -n .;  sleep 1; done
echo 
