#!/bin/bash

set -eu

readonly IMAGE_NAME="uproxy/build"
BUILD=false
PUBLISH=false

function error() {
  echo "$@" >&2
}

function usage() {
  cat <<-EOM
Usage: $0 [-b] [-p] commands
  -b (re-)build Docker image
  -p publish Docker image to Docker Hub (you must be logged in)

Examples:
  $0 -b
  $0 npm run clean
  $0 npm install
  $0 grunt build_chrome
EOM
exit 1
}

while getopts bph? opt; do
  case $opt in
    b) BUILD=true ;;
    p) PUBLISH=true ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

if ! which docker > /dev/null; then
  error "You must install docker first. See https://docs.docker.com/engine/installation/"
  exit 1
fi

if [[ $BUILD = true ]]; then
  readonly DOCKER_ROOT="$(dirname $0)"
  docker build --rm -t $IMAGE_NAME $DOCKER_ROOT
fi

if [[ $PUBLISH = true ]]; then
  docker push $IMAGE_NAME
  echo "Find the new image at https://hub.docker.com/r/$IMAGE_NAME/tags/"
fi

if (( $# > 0 )); then
  readonly GIT_ROOT=`git rev-parse --show-toplevel`
  docker run --rm -ti -v "$GIT_ROOT":/worker -w /worker $IMAGE_NAME "$@"
  # TODO: Don't spin up a second container just to chown.
  docker run --rm -ti -v "$GIT_ROOT":/worker -w /worker $IMAGE_NAME chown -R $(stat -c "%u:%g" .git) /worker
fi
