#!/bin/bash
set -eu

function check_prerequisites() {
  if ! which docker > /dev/null; then
    echo "You must install docker first. See https://docs.docker.com/engine/installation/"
    return 1
  fi

  if [[ ! -d .git ]]; then
    echo "You must run $(basename $0) from the repository root"
    return 2
  fi
}

function get_image_version() {
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
}

function enter() {
  run bash
}

function run() {
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
  IMAGE_DIR="$(dirname $0)" "$@"
}

main "$@"
