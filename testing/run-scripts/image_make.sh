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

case $BROWSER in
    chr|chrome|CHROME)
        BROWSER=chrome
        case $VERSION in
            dev|DEV) VERSION=dev ;;
            rel|release|REL|RELEASE) VERSION=rel ;;
            canary|CANARY) VERSION=canary ;;
            *)
                echo "Unknown version of chrome: $2.   Options are dev, rel(ease), and canary."
                exit 1;
                ;;
        esac
        ;;
    ff|firefox|FF|FIREFOX)
        BROWSER=firefox
        case $VERSION in
            aur|aurora|AUR|AURORA) VERSION=aurora ;;
            beta|BETA) VERSION=beta ;;
            rel|release|REL|RELEASE) VERSION=rel ;;
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

DIR=/tmp/$BROWSER-$VERSION
rm -rf $DIR
mkdir $DIR
./gen_image.sh $BROWSER $VERSION >$DIR/Dockerfile
cp -R $(pwd)/../integration/test $DIR/test
sudo docker build -t uproxy/$BROWSER-$VERSION $DIR
