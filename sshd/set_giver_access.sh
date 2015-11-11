#!/bin/bash

# Sets the giver account's password, given an invite code.

set -e

function usage () {
  echo "$0 path-to-invite-code"
  exit 1
}

if [ $# -lt 1 ]
then
  usage
fi

if [ ! -f $1 ]
then
  echo "file does not exist" 2>&1
  exit 1
fi

INVITE=`cat $1|base64 -d`

PASS=`echo $INVITE|jq -r .pass`
# TOOD: use -e when we move to a newer version of jq
if [ "$PASS" == "null" ]
then
  echo "invite code does not contain a password" 2>&1
  exit 1
fi

echo giver:"$PASS" | chpasswd
