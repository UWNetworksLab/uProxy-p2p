#!/bin/bash

set -e

# Starts a flood server and prints the IP of its container.

if [ "$#" -ne 1 ]; then
  echo "Usage: flood.sh <size of download, e.g. 128M>"
  exit 1
fi

CONTAINER_ID=`docker run -d uproxy/flood $1`

docker inspect --format '{{ .NetworkSettings.IPAddress }}' $CONTAINER_ID
