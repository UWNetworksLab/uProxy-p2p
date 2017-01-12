#!/bin/sh

# Generates access codes.
# Invoked without arguments, a new access code is issued.

set -e

readonly USERNAME=getter
AUTOMATED=false
ENCODED_PUBLIC_KEY=

function usage () {
  echo "$0 [-a] [-k key]"
  echo "  -a: do not output complete invite URL"
  echo "  -k: public key, base64 encoded (if unspecified, a new invite code is generated)"
  echo "  -h, -?: this help message"
  exit 1
}

while getopts k:ah? opt; do
  case $opt in
    a) AUTOMATED=true ;;
    k) ENCODED_PUBLIC_KEY="$OPTARG" ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

if [ -z "$ENCODED_PUBLIC_KEY" ]; then
  # 1536 bits results in an encoded URL of ~1800 characters which is
  # readily shareable by instant messaging.
  TMP=`mktemp -d`
  ssh-keygen -C "$USERNAME" -q -t rsa -b 1536 -N '' -f $TMP/id_rsa
  ENCODED_PRIVATE_KEY=`base64 $TMP/id_rsa|tr -d '\n'`
  ENCODED_PUBLIC_KEY=`base64 $TMP/id_rsa.pub|tr -d '\n'`
fi

# Apply the credentials to the account, with access restrictions.
# All authorized_keys options:
#  http://man.openbsd.org/sshd.8
# The restrict option was added in OpenSSH 7.2 and protects against
# any future features being enabled on us by default.
KEY_OPTS='restrict,command="/login.sh",port-forwarding,permitopen="zork:9000"'
HOMEDIR=`getent passwd $USERNAME | cut -d: -f6`
echo "$KEY_OPTS $ENCODED_PUBLIC_KEY" >> $HOMEDIR/.ssh/authorized_keys

# If we generated an access code, output that access code.
if [ -n "ENCODED_PRIVATE_KEY" ]; then
  PUBLIC_IP=`cat /hostname`
  readonly CLOUD_INSTANCE_DETAILS_JSON="{\"host\":\"$PUBLIC_IP\",\"user\":\"$USERNAME\",\"key\":\"$ENCODED_PRIVATE_KEY\"}"

  if [ "$AUTOMATED" = false ]; then
    apk update
    apk add nodejs
    npm set strict-ssl=false
    npm install -g jsurl

    # There was a long-standing issue by which, thanks to a stray pair of
    # single quotes, we jsurl-ified a JSON string rather than an Object.
    # It's not clear how to fix this without breaking older clients so
    # we continue to output the older version for now.
    readonly URL_PREFIX="https://www.uproxy.org/invite/?v=2&networkName=Cloud&networkData="
    readonly NETWORK_DATA_JSURLIFIED_JSON=`node -p -e "require('/usr/lib/node_modules/jsurl').stringify('$CLOUD_INSTANCE_DETAILS_JSON');"`
    readonly NETWORK_DATA_JSURL=`node -p -e "require('/usr/lib/node_modules/jsurl').stringify($CLOUD_INSTANCE_DETAILS_JSON);"`
    echo
    echo "INVITE_CODE_URL: ${URL_PREFIX}${NETWORK_DATA_JSURLIFIED_JSON}"
    echo
    echo "INVITE_CODE_URL_FIXED: ${URL_PREFIX}${NETWORK_DATA_JSURL}"
  fi

  # Output invite in JSON format, for the frontend installer.
  # Do this last because the frontend will try to connect as soon
  # as it sees this line and any further steps may mean the Docker
  # container will not actually be started by the time it does so.
  echo
  echo "CLOUD_INSTANCE_DETAILS_JSON: $CLOUD_INSTANCE_DETAILS_JSON"
fi
