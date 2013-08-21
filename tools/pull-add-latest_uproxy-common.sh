#!/usr/bin/env bash
#
# This script will pull the latest version of uproxy-common and add the change
# to the git submodules so that you can "git commit" and push to actually move
# to the latest version of uproxy-common.

START_DIR="$(pwd)"
ROOT_DIR="$(cd "$(dirname $0)"; cd ..; pwd)"
PRG="$(basename "$0")"

echo
echo "### Pulling latest UProxy Chrome App uproxy-common"
CMD="cd $ROOT_DIR/chrome/app/submodules/uproxy-common";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="git pull origin master";
echo "$PREFIX$CMD"; $CMD || exit 1;

echo
echo "### updating UProxy Chrome App submodules"
CMD="git submodule update";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="cd $ROOT_DIR/chrome/app/submodules/uproxy-common/submodules/freedom";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="LOCAL=yes make";
echo "$PREFIX$CMD"; LOCAL=yes make || exit 1;

echo
echo "### adding updated uproxy-common dir to git"
CMD="cd $ROOT_DIR";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="git add $ROOT_DIR/chrome/app/submodules/uproxy-common";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="git status";
echo "$PREFIX$CMD"; $CMD || exit 1;
