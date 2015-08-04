#/bin/bash

# Prints the IP of a flood server, starting one if necessary.
# TODO: restart the running container if the args differ

if [ "$#" -ne 2 ]; then
  echo "Usage: flood.sh <size of download> <max. transfer rate>"
  echo "Examples:"
  echo "  10MB @ 500k/sec: flood.sh 10M 500k"
  echo "  1GB @ 1M/sec: flood.sh 1G 10M"
  exit 1
fi

if ! docker ps | grep uproxy-flood >/dev/null; then
  if ! docker images | grep uproxy/flood >/dev/null; then
    docker build -t uproxy/flood ${BASH_SOURCE%/*}/../../flood
  fi
  docker run -d -p 1224:1224 --name uproxy-flood uproxy/flood "$1"M $2
fi
docker inspect --format '{{ .NetworkSettings.IPAddress }}' uproxy-flood
