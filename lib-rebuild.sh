#!/bin/bash
./setup.sh clean
mkdir node_modules
pushd node_modules
ln -s ../../uproxy-lib .
pushd uproxy-lib
grunt base copy:dist
popd
popd
./setup.sh install
grunt
