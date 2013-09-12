#!/usr/bin/env bash
#
# This script will build UProxy

START_DIR="$(pwd)"
ROOT_DIR="$(cd "$(dirname $0)"; pwd)"
PRG="$(basename "$0")"

echo "START_DIR=$START_DIR"
echo "ROOT_DIR=$ROOT_DIR"
echo "PRG=PRG"

# for command printout messages.
PREFIX="* Running: "

echo
echo "### Install local node modules"
CMD="cd $ROOT_DIR";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="grunt build";
echo "$PREFIX$CMD"; $CMD || exit 1;
