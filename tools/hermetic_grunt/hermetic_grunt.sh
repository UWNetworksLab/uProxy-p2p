#!/bin/bash
if ! which docker > /dev/null; then
  echo "You must install docker first. See https://docs.docker.com/engine/installation/"
  exit 1
fi

if [[ ! -d .git ]]; then
  echo "You must run $(basename $0) from the repository root"
  exit 2
fi

image_name=${GRUNT_IMAGE:-hermetic-grunt}
docker build --rm=true -f $(dirname $0)/Dockerfile -t $image_name . &&
docker run --rm -v $(pwd):/root/repository_root -it $image_name "$@"
