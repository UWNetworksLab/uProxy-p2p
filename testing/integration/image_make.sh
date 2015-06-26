#!/bin/bash

# image_make.sh browser version
# builds a docker image called uproxy/browser-version

if [ $# -lt 2 ]
then
    echo "Two arguments needed: browser and version."
    exit 1
fi

BROWSER=$1
VERSION=$2

echo "Validating BROWSER=$BROWSER and VERSION=$VERSION"
case $BROWSER in
    chr|chrome)
        echo "Validating chrome version..."
        case $VERSION in
            dev|DEV) 
                ;;
            rel|release|REL|RELEASE) 
                ;;
            canary|CANARY) 
                ;;
            *)
                echo "Unknown version of chrome: $2.   Options are dev, rel(ease), and canary."
                exit 1;
                ;;
        esac
        ;;
    ff|firefox)
        echo "Validating firefox version..."
        case $VERSION in
            aurora) ;;
            beta) ;;
            rel|release) ;;
            *)
                echo "Unknown version of firefox: $2.  Options are aurora, beta, and rel(ease)."
                exit 1;
                ;;
        esac
        ;;
    *)
        echo "Unknown browser $1.  Options are firefox and chrome."
        exit 1;
        ;;
esac
echo "Seemed to validate this?"

DIR=/tmp/$BROWSER-$VERSION
echo rm -f $DIR
echo mkdir $DIR
echo "./gen_image.sh $BROWSER $VERSION >$DIR/Dockerfile"
echo ln -s ../test $DIR/test
echo sudo docker build -t uproxy/$BROWSER-$VERSION $DIR
