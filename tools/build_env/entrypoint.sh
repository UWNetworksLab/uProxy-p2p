#!/bin/bash

# This is setup for the tests using Chrome and does not belong here.
# TODO(fortuna): Move this setup to the test task instead.
Xvfb :10 -screen 0 1280x1024x24 2> /dev/null &
export DISPLAY=:10

"$@"
# Fix out/ ownership
chown --recursive $(stat -c "%u:%g" .git) out
