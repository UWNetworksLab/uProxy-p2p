#!/bin/bash

# Sets the giver account's password, given an invite code.
# If no invite code is available then one will be generated.
#
# Intended to be run only as part of the deploy process.

set -e

PUBLIC_IP=

function usage () {
  echo "$0 -d ip path-to-invite-code"
  echo "  -d: IP or hostnmae"
  echo "  -h, -?: this help message"
  exit 1
}

while getopts d:h? opt; do
  case $opt in
    d) PUBLIC_IP="$OPTARG" ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

echo "ip: $PUBLIC_IP"
echo "file: $1"

if [ $# -lt 1 ]
then
  usage
fi

if [ ! -f $1 ]
then
  echo "file does not exist" 2>&1
  exit 1
fi

if [ -z "$PUBLIC_IP" ]
then
  echo "must specify hostname" 2>&1
  usage
fi

if [ -s $1 ]
then
  INVITE=`cat $1|base64 -d`
  PASS=`echo $INVITE|jq -r .pass`
  if [ "$PASS" == "null" ]
  then
    echo "invite code does not contain a password" 2>&1
    exit 1
  fi
else
  PASS=`openssl rand -base64 20`

  # Save a full invite code, which can be output to the user by the host.
  INVITE="{\"host\":\"$PUBLIC_IP\", \"user\":\"giver\", \"pass\":\"$PASS\"}"
  INVITE_CODE=`echo -n $INVITE|base64 -w 0`
  echo -n "$INVITE_CODE" > $1
fi

echo giver:"$PASS" | chpasswd
