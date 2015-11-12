#!/bin/bash

# Configures giver access, given an invite code.
# If no invite code is available then one is generated
# and saved to the supplied path.
#
# Intended to be run only as part of the deploy process.
#
# TODO: remove passwords, they're only for super-old clients during development

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

  ENCODED_KEY=`echo $INVITE|jq -r .key`
  echo "encoded: $ENCODED_KEY"
  if [ "$ENCODED_KEY" == "null" ]
  then
    echo "invite code does not contain a private key" 2>&1
    exit 1
  fi
  echo -n $ENCODED_KEY|base64 -d > /giver
  cat /giver
  chmod 600 /giver
  ssh-keygen -y -f /giver > /giver.pub
else
  PASS=`openssl rand -base64 20`

  # TODO: 2048 bits makes for really long keys so we should use
  #       ecdsa when ssh2-streams supports it:
  #         https://github.com/mscdex/ssh2-streams/issues/3
  ssh-keygen -t rsa -b 2048 -N '' -f /giver

  # Save a full invite code, which can be output to the user by the host.
  # TODO: Because SSH keys are already base64-encoded, re-encoding them
  #       like this is very inefficient.
  ENCODED_KEY=`base64 -w 0 /giver`
  INVITE="{\"host\":\"$PUBLIC_IP\", \"user\":\"giver\", \"pass\":\"$PASS\", \"key\":\"$ENCODED_KEY\"}"
  INVITE_CODE=`echo -n $INVITE|base64 -w 0`
  echo -n "$INVITE_CODE" > $1
fi

echo giver:"$PASS" | chpasswd

mkdir -p ~giver/.ssh
cat /giver.pub > ~giver/.ssh/authorized_keys
