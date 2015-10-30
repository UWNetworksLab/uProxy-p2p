#!/bin/bash

set -e

# Users testing on a LAN will want to override this with their
# internal, non-routable IP (or, more simply, "localhost").
# Everyone else will want their public, external, routable IP.
# This beautiful, cross-platform one-liner gives us this.
# Cogged from:
#   http://unix.stackexchange.com/questions/22615/how-can-i-get-my-external-ip-address-in-bash
HOSTNAME=`dig +short myip.opendns.com @resolver1.opendns.com`

function usage () {
  echo "$0 [-i hostname]"
  echo "  -i: hostname (or ip)"
  echo "  -h, -?: this help message"
  exit 1
}

while getopts i:h? opt; do
  case $opt in
    i) HOSTNAME="$OPTARG" ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

USERNAME=`cat /dev/urandom | tr -dc 'a-z' | fold -w 8 | head -n 1`
PASSWORD=`cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 20 | head -n 1`

adduser --disabled-password --gecos 'uProxy Getter' --ingroup getter $USERNAME
echo $USERNAME:$PASSWORD | chpasswd

INVITE="{\"host\":\"$HOSTNAME\", \"user\":\"$USERNAME\", \"pass\":\"$PASSWORD\"}"
INVITE_CODE=`echo -n $INVITE|base64 -w 0`

echo "invite: $INVITE"
echo "invite code: $INVITE_CODE"
