#!/usr/bin/env bash
#
# This script will update the directly, all submodules, and build everything

START_DIR="$(pwd)"
ROOT_DIR="$(cd "$(dirname $0)"; pwd)"
PRG="$(basename "$0")"

echo "START_DIR=$START_DIR"
echo "ROOT_DIR=$ROOT_DIR"
echo "PRG=PRG"

# for command printout messages.
PREFIX="* Running: "

echo
echo "### Install local dependencies"
CMD="cd $ROOT_DIR";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="npm install";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="grunt setup";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="grunt build";
echo "$PREFIX$CMD"; $CMD || exit 1;
