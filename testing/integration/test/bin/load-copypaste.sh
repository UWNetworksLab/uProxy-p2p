#!/bin/bash

# Loads the copy-paste example app.

# Overlap X startup with our download and build.
export DISPLAY=:10
Xvfb :10 -screen 0 1280x1024x24 &

mkdir -p /test/src
cd /test/src
npm install -g bower grunt-cli
git clone https://github.com/uProxy/uproxy-lib.git
cd uproxy-lib
./setup.sh install
grunt

mkdir /tmp/chrome-data

google-chrome --user-data-dir=/tmp/chrome-data --load-and-launch-app=/test/src/uproxy-lib/build/dev/uproxy-lib/samples/copypaste-socks-chromeapp

# Wait for the control port (9000) to open.
while ! netstat -t | grep localhost:9000 >/dev/null; do sleep 1; done

