#!/bin/bash

# Manages invite codes.
# Invoked without arguments, a new invite code is issued.
# Other options, notably -i, allow invite codes be "imported"
# reinstallation and upgrades.

set -e

INVITE_CODE=
USERNAME=getter
AUTOMATED=false
KEY=

function usage () {
  echo "$0 [-u username] [-i invite code] [-a] [-k key]"
  echo "  -i: invite code (if unspecified, a new invite code is generated)"
  echo "  -u: username (default: getter)"
  echo "  -a: do not output complete invite URL"
  echo "  -k: public key (if unspecified, a new key is generated)"
  echo "  -h, -?: this help message"
  exit 1
}

while getopts i:u:k:ah? opt; do
  case $opt in
    i) INVITE_CODE="$OPTARG" ;;
    u) USERNAME="$OPTARG" ;;
    a) AUTOMATED=true ;;
    k) KEY="$OPTARG" ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

echo "issue_invite: key is $KEY"  # TODO: remove

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
  ssh-keygen -C "$USERNAME" -y -f $TMP/id_rsa > $TMP/id_rsa.pub
else
  # 1536 bits results in an encoded URL of ~1800 characters which is
  # readily shareable by instant messaging.
  ssh-keygen -C "$USERNAME" -q -t rsa -b 1536 -N '' -f $TMP/id_rsa

  # TODO: Because SSH keys are already base64-encoded, re-encoding them
  #       like this is very inefficient.
  ENCODED_KEY=`base64 -w 0 $TMP/id_rsa`
fi

# Apply the credentials to the account, with access restrictions.
# man sshd for the complete list of authorized_keys options.
KEY_OPTS='command="/login.sh",permitopen="zork:9000",no-agent-forwarding,no-pty,no-user-rc,no-X11-forwarding'
HOMEDIR=`getent passwd $USERNAME | cut -d: -f6`
mkdir -p $HOMEDIR/.ssh
echo "$KEY_OPTS" `cat $TMP/id_rsa.pub` >> $HOMEDIR/.ssh/authorized_keys

# Output the actual invite code.
PUBLIC_IP=`cat /hostname`
CLOUD_INSTANCE_DETAILS_JSON="{\"host\":\"$PUBLIC_IP\",\"user\":\"$USERNAME\",\"key\":\"$ENCODED_KEY\"}"

if [ "$AUTOMATED" = false ]
then
  # While any apt-get install command would ordinarily be run at
  # image creation time, we do this here because npm is huge (>150MB)
  # and only manual users need a copy/paste-able URL.
  apt-get update -qq
  apt-get install -qq nodejs npm
  npm install jsurl &>/dev/null
  CLOUD_INSTANCE_DETAILS_JSURL=`nodejs -p -e "require('jsurl').stringify('$CLOUD_INSTANCE_DETAILS_JSON');"`
  echo
  echo "INVITE_CODE_URL: https://www.uproxy.org/invite/?v=2&networkName=Cloud&networkData=$CLOUD_INSTANCE_DETAILS_JSURL"
  echo
fi

# Output invite in JSON format, for the frontend installer.
# Do this last because the frontend will try to connect as soon
# as it sees this line and any further steps may mean the Docker
# container will not actually be started by the time it does so.
# TODO: have uproxy pass -a and hide this when passed
echo "CLOUD_INSTANCE_DETAILS_JSON: $CLOUD_INSTANCE_DETAILS_JSON"
