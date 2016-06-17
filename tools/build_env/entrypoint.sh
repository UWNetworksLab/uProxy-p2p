#!/bin/bash

Xvfb :10 -screen 0 1280x1024x24 &
export DISPLAY=:10
"$@"
# Fix out/ ownership
chown --recursive $(stat -c "%u:%g" .git) out
