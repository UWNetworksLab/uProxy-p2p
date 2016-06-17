#!/bin/bash

function setup() {
  # We can't link the Gruntfile because grunt resolves the link before using its
  # directory as the base to run.
  cp $REPOSITORY_ROOT/Gruntfile.coffee . &&
  mkdir -p $REPOSITORY_ROOT/out/.tscache &&
  ln -s $REPOSITORY_ROOT/{version.py,.git,src,out/.tscache} . &&
  cp --archive --recursive $REPOSITORY_ROOT/out/. build/
  Xvfb :10 -screen 0 1280x1024x24 &
  export DISPLAY=:10
}

# Copy build output to the out/ directory.
function output() {
  # This is a hard-coded list of directories in build/ that we know are not
  # output by the grunt call. TODO(fortuna): Make grunt output to out/ directly
  # so we don't have to hard-code this list.
  rm --recursive build/{third_party,tools} &&
  cp --archive --recursive build/. $REPOSITORY_ROOT/out/
}

setup && grunt "$@"
output
# Fix out/ ownership
chown --recursive $(stat -c "%u:%g" $REPOSITORY_ROOT) $REPOSITORY_ROOT/out
