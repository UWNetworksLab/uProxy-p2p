#!/bin/bash
# load BROWSER
. /etc/test.conf

if [ $# -lt 1 ]
then
    echo "usage: ext-path where ext-path-XXXapp indicates the proper path."
    exit 1
fi

BASENAME=$1

case $BROWSER in
    chrome)
        mkdir /tmp/chrome-data
        EXTDIR=${BASENAME}-chromeapp
        google-chrome --user-data-dir=/tmp/chrome-data --load-and-launch-app=${EXTDIR} --no-default-browser-check --no-first-run &
        ;;
    firefox)
        EXTDIR=${BASENAME}-firefoxapp
        cd $EXTDIR
        jpm run -b /usr/bin/firefox
        ;;
    *)
        echo "No BROWSER variable set in /etc/test.conf."
        exit 1
        ;;
esac
