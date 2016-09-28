#!/bin/bash

set -eu

readonly BASE_NAME="uproxy/build"
VARIANT=default
BUILD=false
PUBLISH=false

function error() {
  echo "$@" >&2
}

function usage() {
  cat <<-EOM
Usage: $0 [-b] [-p] [-v variant] commands
  -b (re-)build Docker image
  -p publish Docker image to Docker Hub (you must be logged in)
  -v target-specific variant, e.g. android

Examples:
  $0 npm run clean
  $0 npm install
  $0 -v android npm run grunt build_android
EOM
exit 1
}

while getopts bpv:h? opt; do
  case $opt in
    b) BUILD=true ;;
    p) PUBLISH=true ;;
    v) VARIANT="$OPTARG" ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

if ! which docker > /dev/null; then
  error "You must install docker first. See https://docs.docker.com/engine/installation/"
  exit 1
fi

readonly IMAGE_NAME=$BASE_NAME-$VARIANT

if [[ $BUILD = true ]]; then
  readonly DOCKER_ROOT="$(dirname $0)/$VARIANT"
  docker build --rm -t $IMAGE_NAME $DOCKER_ROOT
fi

if [[ $PUBLISH = true ]]; then
  docker push $IMAGE_NAME
  echo "Find the new image at https://hub.docker.com/r/$IMAGE_NAME"
fi

if (( $# > 0 )); then
  readonly GIT_ROOT=`git rev-parse --show-toplevel`
  docker run --rm -ti -v "$GIT_ROOT":/worker -w /worker $IMAGE_NAME "$@"
  # TODO: Don't spin up a second container just to chown.
  docker run --rm -ti -v "$GIT_ROOT":/worker -w /worker $IMAGE_NAME chown -R $(stat -c "%u:%g" .git) /worker
fi
