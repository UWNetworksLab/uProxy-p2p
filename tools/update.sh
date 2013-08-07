#!/usr/bin/env bash

START_DIR="$(pwd)"
ROOT_DIR="$(cd "$(dirname $0)"; cd ..; pwd)"
PRG="$(basename "$0")"

echo "START_DIR=$START_DIR"
echo "ROOT_DIR=$ROOT_DIR"
echo "PRG=PRG"

# for command printout messages.
PREFIX=""

echo "### Updating UProxy root git repo"
CMD="cd $ROOT_DIR";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="git pull";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="git submodule init"
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="git submodule update";
echo "$PREFIX$CMD"; $CMD || exit 1;

echo "### Updating UProxy Chrome App"
CMD="cd $ROOT_DIR/chrome/app/submodules/uproxy-common";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="git submodule init";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="git submodule update";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="cd $ROOT_DIR/chrome/app/submodules/uproxy-common/submodules/freedom";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="LOCAL=yes make";
echo "$PREFIX$CMD"; LOCAL=yes make || exit 1;

echo "### Updating UProxy Chrome Extension"
CMD="cd $ROOT_DIR/chrome/extension";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="npm install";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="bower install";
echo "$PREFIX$CMD"; $CMD || exit 1;

echo "### Updating UProxy Firefox Extension"
CMD="cd $ROOT_DIR/firefox/data/submodules/uproxy-common";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="git submodule init"
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="git submodule update";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="cd $ROOT_DIR/firefox/data/submodules/uproxy-common/submodules/freedom";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="LOCAL=yes make"
echo "$PREFIX$CMD"; LOCAL=yes make || exit 1;

echo "### Finishing up, running git stats, and returning to your previous directory"
CMD="cd $ROOT_DIR";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="git status";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="cd $START_DIR";
echo "$PREFIX$CMD"; $CMD || exit 1;

echo "Success!";
