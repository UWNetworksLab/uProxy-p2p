#!/bin/bash

# Issues a new invite code.

set -e

# Beautiful cross-platform one-liner cogged from:
#   http://unix.stackexchange.com/questions/22615/how-can-i-get-my-external-ip-address-in-bash
PUBLIC_IP=`dig +short myip.opendns.com @resolver1.opendns.com`
INVITE_CODE=
USERNAME=getter

function usage () {
  echo "$0 [-d ip] [-u username] [-i path-to-invite-code]"
  echo "  -d: override the detected public IP (for development only)"
  echo "  -i: invite code (if unspecified, a new invite code is generated)"
  echo "  -u: username (default: getter)"
  echo "  -h, -?: this help message"
  exit 1
}

while getopts d:i:u:h? opt; do
  case $opt in
    d) PUBLIC_IP="$OPTARG" ;;
    i) INVITE_CODE="$OPTARG" ;;
    u) USERNAME="$OPTARG" ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

TMP=`mktemp -d`

# Either read the supplied invite code or generate a new one.
if [ -n "$INVITE_CODE" ]
then
  INVITE=`echo -n $INVITE_CODE|base64 -d`

  ENCODED_KEY=`echo $INVITE|jq -r .key`
  if [ "$ENCODED_KEY" == "null" ]
  then
    echo "invite code does not contain a private key" 2>&1
    exit 1
  fi
  echo -n $ENCODED_KEY|base64 -d > $TMP/id_rsa
  chmod 600 $TMP/id_rsa
  ssh-keygen -y -f $TMP/id_rsa > $TMP/id_rsa.pub
else
  # TODO: 2048 bits makes for really long keys so we should use
  #       ecdsa when ssh2-streams supports it:
  #         https://github.com/mscdex/ssh2-streams/issues/3
  ssh-keygen -q -t rsa -b 2048 -N '' -f $TMP/id_rsa

  # TODO: Because SSH keys are already base64-encoded, re-encoding them
  #       like this is very inefficient.
  ENCODED_KEY=`base64 -w 0 $TMP/id_rsa`
fi

# Apply the credentials to the account.
HOMEDIR=`getent passwd $USERNAME | cut -d: -f6`
mkdir -p $HOMEDIR/.ssh
cat $TMP/id_rsa.pub >> $HOMEDIR/.ssh/authorized_keys

# Output the actual invite code.
INVITE="{\"host\":\"$PUBLIC_IP\", \"user\":\"$USERNAME\", \"key\":\"$ENCODED_KEY\"}"
echo -n $INVITE|base64 -w 0
