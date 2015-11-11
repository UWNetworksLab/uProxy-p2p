#!/bin/bash

# Adds users to the getter group with a random password, outputting
# an invite code for each. This is just for prototyping purposes
# while we iron out issues with key-based authentication in the client.

set -e

# Beautiful cross-platform one-liner cogged from:
#   http://unix.stackexchange.com/questions/22615/how-can-i-get-my-external-ip-address-in-bash
PUBLIC_IP=`dig +short myip.opendns.com @resolver1.opendns.com`

function usage () {
  echo "$0 [-d ip]"
  echo "  -d: override the detected public IP (for development only)"
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

USERNAME=`cat /dev/urandom | tr -dc 'a-z' | fold -w 8 | head -n 1`
PASSWORD=`openssl rand -base64 20`

adduser --disabled-password --gecos 'uProxy Getter' --ingroup getter $USERNAME
echo $USERNAME:$PASSWORD | chpasswd

INVITE="{\"host\":\"$PUBLIC_IP\", \"user\":\"$USERNAME\", \"pass\":\"$PASSWORD\"}"
INVITE_CODE=`echo -n $INVITE|base64 -w 0`

echo "invite: $INVITE"
echo "invite code: $INVITE_CODE"
