#!/bin/bash
set -e

Xvfb :10 -screen 0 1280x1024x24 &
sleep 3
cd /uproxy

bower install --allow-root

grunt test 
