#!/bin/bash

# Runs a Zork and SSH server, each in their own Docker containers.
# The SSH server may be used to establish a secure tunnel to Zork,
# which is configured to accept connections from localhost.
#
# uProxy's cloud social provider knows how to establish such a tunnel,
# assuming sshd is running on port 5000 and that Zork is accessible
# via the sshd server at zork:9000.

set -e

PREBUILT=
NPM=true
INVITE_CODE=
UPDATE=false
WIPE=false
PUBLIC_IP=
BANNER=

SSHD_PORT=5000

function usage () {
  echo "$0 [-p path] [-i invite code] [-u] [-w] [-d ip] [-b banner] browser-version"
  echo "  -p: path to pre-built uproxy-lib repository"
  echo "  -i: bootstrap invite (only for new installs, or with -w)"
  echo "  -u: rebuild Docker images (preserves invites and metadata unless -w used)"
  echo "  -w: when -u used, do not copy invites or metadata from current installation"
  echo "  -d: override the detected public IP (for development only)"
  echo "  -b: name to use in contacts list"
  echo "  -h, -?: this help message"
  echo
  echo "Example browser-version: chrome-stable, firefox-canary"
  exit 1
}

while getopts p:i:uwd:b:h? opt; do
  case $opt in
    p) PREBUILT="$OPTARG" ;;
    i) INVITE_CODE="$OPTARG" ;;
    u) UPDATE=true ;;
    w) WIPE=true ;;
    d) PUBLIC_IP="$OPTARG" ;;
    b) BANNER="$OPTARG" ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

if [ $# -lt 1 ]
then
  usage
fi

if [ "$WIPE" = true ] && [ "$UPDATE" = false ]
then
  echo "-u must be used when -w is used"
  usage
fi

# Set the cloud instance's banner.
# In descending order of preference:
#  - command-line option
#  - pull from existing container
#  - automatic, using provider-specific APIs
#  - server's hostname
if [ -z "$BANNER" ]
then
  if docker ps -a | grep uproxy-sshd >/dev/null
  then
    if [ `docker inspect --format='{{ .State.Status }}' uproxy-sshd` != "running" ]
    then
      docker start uproxy-sshd > /dev/null
    fi
    BANNER=`docker exec uproxy-sshd cat /banner`
  else
    # Quickly try (timeout after two seconds) DigitalOcean's
    # metadata API which can tell us the region in which a
    # droplet is located:
    #   https://developers.digitalocean.com/documentation/metadata/#metadata-api-endpoints
    BANNER=`curl -s -m 2 http://169.254.169.254/metadata/v1/region || echo -n ""`
    if [ -n "$BANNER" ]
    then
      BANNER=`echo "$BANNER"|sed 's/ams./Amsterdam/;s/sgp./Singapore/;s/fra./Frankfurt/;s/tor./Toronto/;s/nyc./New York/;s/sfo./San Francisco/;s/lon./London/'`
      BANNER="$BANNER (DigitalOcean)"
    else
      BANNER=`hostname`
    fi
  fi
fi

# Set the cloud instance's hostname.
# In descending order of preference:
#  - command-line option
#  - pull from existing container
#  - pull from DNS
if [ -z "$PUBLIC_IP" ]
then
  if docker ps -a | grep uproxy-sshd >/dev/null
  then
    if [ `docker inspect --format='{{ .State.Status }}' uproxy-sshd` != "running" ]
    then
      docker start uproxy-sshd > /dev/null
    fi
    # Don't fail if the current installation has no /hostname.
    PUBLIC_IP=`docker exec uproxy-sshd cat /hostname || echo -n ""`
  fi
  if [ -z "$PUBLIC_IP" ]
  then
    # Beautiful cross-platform one-liner cogged from:
    #   http://unix.stackexchange.com/questions/22615/how-can-i-get-my-external-ip-address-in-bash
    PUBLIC_IP=`dig +short myip.opendns.com @resolver1.opendns.com`
  fi
fi

# Migrate the giver and getter accounts' authorized_keys.
if [ "$WIPE" = false ]
then
  if docker ps -a | grep uproxy-sshd >/dev/null
  then
    if [ `docker inspect --format='{{ .State.Status }}' uproxy-sshd` != "running" ]
    then
      docker start uproxy-sshd > /dev/null
    fi
    GIVER_AUTH_KEYS=`docker exec uproxy-sshd cat /home/giver/.ssh/authorized_keys || echo -n ""`
    GETTER_AUTH_KEYS=`docker exec uproxy-sshd cat /home/getter/.ssh/authorized_keys || echo -n ""`

    # Because it's unclear what it would mean to migrate authorized_keys files
    # when -i is supplied, restrict use of -i to new or wiping (-w) installs.
    if [ -n "$INVITE_CODE" ]
    then
      echo "-i can only be used for new installs or with -w"
      usage
    fi
  fi
fi

if [ "$UPDATE" = true ]
then
  docker rm -f uproxy-sshd || true
  docker rm -f uproxy-zork || true
  docker rmi uproxy/sshd || true
  # TODO: This will fail if there are any containers using the
  #       image, e.g. run_pair.sh. Regular cloud users won't be.
  docker rmi uproxy/$1 || true
fi

# IP of the host machine.
# Useful because zork runs with --net=host.
HOST_IP=`ip -o -4 addr list docker0 | awk '{print $4}' | cut -d/ -f1`

# Start Zork, if necessary.
if ! docker ps -a | grep uproxy-zork >/dev/null; then
  if ! docker images | grep uproxy/$1 >/dev/null; then
    BROWSER=$(echo $1 | cut -d - -f 1)
    VERSION=$(echo $1 | cut -d - -f 2)
    ${BASH_SOURCE%/*}/image_make.sh $BROWSER $VERSION
  fi
  HOSTARGS=
  if [ ! -z "$PREBUILT" ]
  then
    NPM=false
    HOSTARGS="$HOSTARGS -v $PREBUILT:/test/src/uproxy-lib"
  fi
  RUNARGS=
  if [ ! -z "$PREBUILT" ]
  then
    RUNARGS="$RUNARGS -p"
  fi
  if [ "$NPM" = true ]
  then
    RUNARGS="$RUNARGS -n"
  fi
  # NET_ADMIN is required to run iptables inside the container.
  # Full list of capabilities:
  #   https://docs.docker.com/engine/reference/run/#runtime-privilege-linux-capabilities-and-lxc-configuration
  docker run --restart=always --net=host --cap-add NET_ADMIN $HOSTARGS --name uproxy-zork -d uproxy/$1 /test/bin/load-zork.sh $RUNARGS -z true

  echo -n "Waiting for Zork to come up..."
  while ! ((echo ping ; sleep 0.5) | nc -w 1 $HOST_IP 9000 | grep ping) > /dev/null; do echo -n .; done
  echo "ready!"
fi

# Start sshd, if necessary.
if ! docker ps -a | grep uproxy-sshd >/dev/null; then
  if ! docker images | grep uproxy/sshd >/dev/null; then
    TMP_DIR=/tmp/uproxy-sshd
    rm -fR $TMP_DIR
    cp -R ${BASH_SOURCE%/*}/../../sshd/ $TMP_DIR

    echo -n "$BANNER" > $TMP_DIR/banner
    echo -n "$PUBLIC_IP" > $TMP_DIR/hostname

    docker build -t uproxy/sshd $TMP_DIR
  fi

  # Add an /etc/hosts entry to the Zork container.
  # Because the Zork container runs with --net=host, we can't use the
  # regular, ever-so-slightly-more-elegant Docker notation.
  docker run --restart=always -d -p $SSHD_PORT:22 --name uproxy-sshd --add-host zork:$HOST_IP uproxy/sshd > /dev/null

  # Configure access.
  # In descending order of preference:
  #  - migrate authorized_keys or apply -i
  #  - issue a new invite
  if [ -n "$GIVER_AUTH_KEYS" ] || [ -n "$GETTER_AUTH_KEYS" ]
  then
    docker exec uproxy-sshd sh -c "echo $GIVER_AUTH_KEYS > /home/giver/.ssh/authorized_keys"
    docker exec uproxy-sshd sh -c "echo $GETTER_AUTH_KEYS > /home/getter/.ssh/authorized_keys"
  else
    if [ -n "$INVITE_CODE" ]
    then
      INVITE_CODE=`docker exec uproxy-sshd /issue_invite.sh -i "$INVITE_CODE"`
    else
      INVITE_CODE=`docker exec uproxy-sshd /issue_invite.sh -c`
      echo -e "\nINVITE CODE URL:\n$INVITE_CODE"
    fi
  fi
fi
