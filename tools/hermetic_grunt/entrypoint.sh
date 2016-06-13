#!/bin/bash
set -e

# Clean the tscache while we figure out how to make it work across calls.
# TODO(fortuna): Fix this.
rm -r $REPOSITORY_ROOT/out/.tscache

# We can't link the Gruntfile because grunt resolves the link before using its
# directory as the base to run.
cp $REPOSITORY_ROOT/Gruntfile.coffee .
mkdir -p $REPOSITORY_ROOT/out/.tscache
ln -s $REPOSITORY_ROOT/{version.py,.git,src,out/.tscache} .

grunt "$@"

# Copy build output to the out/ directory.
# TODO(fortuna): Make grunt output to out/ directly.
rm --recursive build/{third_party,tools}
cp --archive --recursive build/* $REPOSITORY_ROOT/out/
chown --recursive $(stat -c "%u:%g" $REPOSITORY_ROOT) $REPOSITORY_ROOT/out
