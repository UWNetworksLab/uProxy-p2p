#!/bin/bash

# image_make.sh browser version
# builds a docker image called uproxy/browser-version

if [ $# -lt 2 ]
then
  echo "Two arguments needed: browser and version."
  exit 1
fi
source "${BASH_SOURCE%/*}/utils.sh" || (echo "cannot find utils.sh" && exit 1)

BROWSER=$1
VERSION=$2

DIR=/tmp/$BROWSER-$VERSION
rm -rf $DIR
mkdir $DIR
./gen_image.sh $BROWSER $VERSION $DIR >$DIR/Dockerfile
cp -R ${BASH_SOURCE%/*}/../integration/test $DIR/test
docker build -t uproxy/$BROWSER-$VERSION $DIR
