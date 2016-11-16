#!/bin/sh
socat -U TCP-LISTEN:1224,reuseaddr,fork EXEC:"dd if=/dev/zero bs=$1 count=1"
