#!/bin/bash

# Manages invite codes.
# Invoked without arguments, a new invite code is issued.
# Other options, notably -i, allow invite codes be "imported"
# reinstallation and upgrades.

set -e

INVITE_CODE=
USERNAME=getter
COMPLETE=false

function usage () {
  echo "$0 [-u username] [-i invite code] [-c]"
  echo "  -i: invite code (if unspecified, a new invite code is generated)"
  echo "  -u: username (default: getter)"
  echo "  -c: output complete invite URL (for manual installs)"
  echo "  -h, -?: this help message"
  exit 1
}

while getopts i:u:ch? opt; do
  case $opt in
    i) INVITE_CODE="$OPTARG" ;;
    u) USERNAME="$OPTARG" ;;
    c) COMPLETE=true ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

TMP=`mktemp -d`

# Either read the supplied invite code or generate a new one.
if [ -n "$INVITE_CODE" ]
then
  INVITE=`echo -n $INVITE_CODE|base64 -d`

  NETWORK_DATA=`echo $INVITE|jq -r .networkData`
  if [ "$NETWORK_DATA" == "null" ]
  then
    echo "invite code does not contain networkData" 2>&1
    exit 1
  fi
  ENCODED_KEY=`echo $NETWORK_DATA|jq -r .key`
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
PUBLIC_IP=`cat /hostname`
export CLOUD_INSTANCE_DETAILS="{\"host\":\"$PUBLIC_IP\",\"user\":\"$USERNAME\",\"key\":\"$ENCODED_KEY\"}"

# Output invite in JSON format, for the frontend installer.
echo "CLOUD_INSTANCE_DETAILS_JSON:$CLOUD_INSTANCE_DETAILS"

if [ "$COMPLETE" = true ]
then
  npm install jsurl &>/dev/null
  CLOUD_INSTANCE_DETAILS=`nodejs -p -e "require('jsurl').stringify('$CLOUD_INSTANCE_DETAILS');"`
  echo "https://www.uproxy.org/invite/?v=2&networkName=Cloud&networkData=$CLOUD_INSTANCE_DETAILS"
else
  echo $CLOUD_INSTANCE_DETAILS
fi
