#!/bin/bash
# This is a wrapper script for accessing the 'tsd' script, which exist inside of
# the node module 'grunt-tsd', which should be auto-installed by running
# `npm install`.

owd=`pwd`;cwd=${0%/*}
tsd='node_modules/grunt-tsd/node_modules/tsd/build/cli.js'
echo $owd
echo $cwd
# Run the command from the uProxy root directory.
cd $cwd
cd ..
[[ -z $1 ]] && arg='-h' || arg=$1
$tsd query $arg --action install -s
cd $owd
