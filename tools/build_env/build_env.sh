#!/bin/bash
set -eu

function error() {
  echo "$@" >&2
}

function help() {
  cat <<-EOM
usage: $0 [<command>]

The <command> will fall in a few categories:

Build-related
  enter            Starts a bash session in the build environment
  run <command>    Runs the given command in the build environment and returns

Image management
  update_image     Rebuilds the build environment image
  publish_image    Publishes the current build environment image to Docker hub.
                   Needs to be logged in to the Docker hub (docker login).
  get_image_version    Outputs the name and tag of the build environment
                   Docker image
  set_image_version <version>    Sets the name and tag of the Docker image to be
                   used

If no command is specified, it will assume the enter command.
EOM
}

function check_prerequisites() {
  if ! which docker > /dev/null; then
    error "You must install docker first. See https://docs.docker.com/engine/installation/"
    return 1
  fi

  if [[ ! -d .git ]]; then
    error "You must run $(basename $0) from the repository root"
    return 2
  fi
}

function get_image_version() {
  if (( $# > 0 )); then
    error "[get_image_version] takes no argument"
    return 3
  fi
  cat $IMAGE_DIR/IMAGE_VERSION.txt
}

function set_image_version() {
  echo "$1" > $IMAGE_DIR/IMAGE_VERSION.txt
}

function update_image() {
  local image_version=uproxy/build:$(git log --pretty=format:'%h' -n 1)
  docker build --rm -f $IMAGE_DIR/Dockerfile -t $image_version .
  set_image_version $image_version
}

function publish_image() {
  docker push $(get_image_version)
  echo "Find the new image at https://hub.docker.com/r/uproxy/build/tags/"
}

function enter() {
  if (( $# > 0 )); then
    error "[enter] takes no argument"
    return 3
  fi
  run bash
}

function run() {
  if (( $# == 0 )); then
    error "[run] expects the command to be run in the build environment"
    return 3
  fi
  docker run --rm \
      -v $(pwd)/Gruntfile.coffee:/root/build_root/Gruntfile.coffee:ro \
      -v $(pwd)/version.py:/root/build_root/version.py:ro \
      -v $(pwd)/.git:/root/build_root/.git:ro \
      -v $(pwd)/src:/root/build_root/src:ro \
      -v $(pwd)/out/.tscache:/root/build_root/.tscache \
      -v $(pwd)/out/.grunt:/root/build_root/.grunt \
      -v $(pwd)/out/dev:/root/build_root/build/dev \
      -v $(pwd)/out/dist:/root/build_root/build/dist \
      -v $(pwd)/out:/root/build_root/out \
      -it $(get_image_version) "$@"
}

function main() {
  check_prerequisites || return
  (
    IMAGE_DIR="$(dirname $0)"
    if (( $# == 0 )); then
      enter
    elif ! type -t $1 > /dev/null; then
      error -e "Invalid command $1\n"
      help
    else
      "$@"
    fi
  )
}

main "$@"
