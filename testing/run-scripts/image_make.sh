#!/bin/bash

# image_make.sh browser version
# builds a docker image called uproxy/browser-version

if [ $# -lt 2 ]
then
    echo "Two arguments needed: browser and version."
    exit 1
elif [ ! -x "${BASH_SOURCE%/*}/utils.sh" ]
then
    echo "Scripted called incorrectly, or improperly installed."
    exit 1
fi

source "${BASH_SOURCE%/*}/utils.sh"


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
                log "Unknown version of chrome: $2.   Options are dev, rel(ease), and canary."
                exit 1;
                ;;
        esac
        ;;
    lcr|lchrome|localchrome|LCR|LCHROME|LOCALCHROME)
        BROWSER=localchrome
        case $VERSION in
            debug|dbg|d|DEBUG|DBG|D|Debug)
                VERSION=debug
                # validate the path.
                chrome_build_path Debug
                ;;
            release|rel|r|RELEASE|REL|R|Release)
                VERSION=release
                # validate the path.
                chrome_build_path Release
                ;;
            *)
                log "Unknown version of localchrome: $2. Options are debug and release."
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
                log "Unknown version of firefox: $2.  Options are aurora, beta, and rel(ease)."
                exit 1;
                ;;
        esac
        ;;
    *)
        log "Unknown browser $1.  Options are firefox and chrome."
        exit 1;
        ;;
esac

DIR=/tmp/$BROWSER-$VERSION
rm -rf $DIR
mkdir $DIR
./gen_image.sh $BROWSER $VERSION $DIR >$DIR/Dockerfile
cp -R ${BASH_SOURCE%/*}/../integration/test $DIR/test
sudo docker build -t uproxy/$BROWSER-$VERSION $DIR
