#!/usr/bin/env bash
#
# This script will update the directly, all submodules, and build everything to
# bring you to the latest version from the git repository.

START_DIR="$(pwd)"
ROOT_DIR="$(cd "$(dirname $0)"; cd ..; pwd)"
PRG="$(basename "$0")"

echo "START_DIR=$START_DIR"
echo "ROOT_DIR=$ROOT_DIR"
echo "PRG=PRG"

# for command printout messages.
PREFIX="* Running: "

echo
echo "### Updating UProxy root git repo"
CMD="cd $ROOT_DIR";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="git status";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="cd $ROOT_DIR/chrome/app/submodules/uproxy-common";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="git status"
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="cd $ROOT_DIR/chrome/app/submodules/uproxy-common/submodules/freedom";
echo "$PREFIX$CMD"; $CMD || exit 1;
CMD="git status"
echo "$PREFIX$CMD"; $CMD || exit 1;
