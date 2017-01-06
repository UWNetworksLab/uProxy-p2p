#!/bin/bash

# Runs a Zork and SSH server, each in their own Docker containers.
# The SSH server may be used to establish a secure tunnel to Zork,
# which is configured to accept connections from localhost.
#
# uProxy's cloud social provider knows how to establish such a tunnel,
# assuming sshd is running on port 5000 and that Zork is accessible
# via the sshd server at zork:9000.

set -e

PREBUILT=false
ZORK_IMAGE="uproxy/zork"
SSHD_IMAGE="uproxy/sshd"
UPDATE=false
WIPE=false
PUBLIC_IP=
BANNER=
AUTOMATED=false
KEY=

SSHD_PORT=5000

function usage () {
  echo "$0 [-p] [-z zork_image] [-s sshd_image] [-u] [-w] [-d ip] [-b banner] [-a] [-k key]"
  echo "  -p: use Zork from this client rather than the Docker image"
  echo "  -z: use a specified Zork image (defaults to uproxy/zork)"
  echo "  -s: use a specified sshd image (defaults to uproxy/sshd)"
  echo "  -u: rebuild Docker images (preserves invites and metadata unless -w used)"
  echo "  -w: when -u used, do not copy invites or metadata from current installation"
  echo "  -d: override the detected public IP (for development only)"
  echo "  -b: name to use in contacts list"
  echo "  -a: do not output complete invite URL"
  echo "  -k: public key, base64 encoded in PEM format (if unspecified, a new invite code is generated)"
  echo "  -h, -?: this help message"
  exit 1
}

while getopts pz:s:uwd:b:k:ah? opt; do
  case $opt in
    p) PREBUILT=true ;;
    z) ZORK_IMAGE="$OPTARG" ;;
    s) SSHD_IMAGE="$OPTARG" ;;
    u) UPDATE=true ;;
    w) WIPE=true ;;
    d) PUBLIC_IP="$OPTARG" ;;
    b) BANNER="$OPTARG" ;;
    a) AUTOMATED=true ;;
    k) KEY="$OPTARG" ;;
    *) usage ;;
  esac
done
shift $((OPTIND-1))

if [ "$UPDATE" = true ]
then
  # Wipe any existing containers, first backing up data from the sshd
  # container, if one exists, unless -w was used.
  if [ "$WIPE" = false ]
  then
    if docker ps -a | grep uproxy-sshd >/dev/null
    then
      # Start the container, if necessary.
      if [ `docker inspect --format='{{ .State.Status }}' uproxy-sshd` != "running" ]
      then
        docker start uproxy-sshd > /dev/null
      fi

      # Banner and hostname/IP.
      if [ -z "$BANNER" ]
      then
        BANNER=`docker exec uproxy-sshd cat /banner || echo -n ""`
      fi
      if [ -z "$PUBLIC_IP" ]
      then
        PUBLIC_IP=`docker exec uproxy-sshd cat /hostname || echo -n ""`
      fi

      AUTH_KEYS=`docker exec uproxy-sshd cat /home/getter/.ssh/authorized_keys | base64 -w 0|| echo -n ""`

      # Because it's unclear what it would mean to migrate authorized_keys files,
      # restrict use of -k to new or wiping (-w) installs.
      if [ -n "$KEY" ]
      then
        echo "-k can only be used for new installs or with -w"
        usage
      fi
    fi
  fi

  docker rm -f uproxy-sshd uproxy-zork || true
  docker rmi $SSHD_IMAGE $ZORK_IMAGE || true
elif [ "$WIPE" = true ]
then
  echo "-u must be used when -w is used"
  usage
fi

# Set banner and hostname/IP if none were specified on the command line or
# migrated from the previous installation.
if [ -z "$BANNER" ]
then
  # Quickly try (timeout after two seconds) DigitalOcean's
  # metadata API which can tell us the region in which a
  # droplet is located:
  #   https://developers.digitalocean.com/documentation/metadata/#metadata-api-endpoints
  BANNER=`curl -s -m 2 http://169.254.169.254/metadata/v1/region || echo -n ""`
  if [ -n "$BANNER" ]
  then
    BANNER=`echo "$BANNER"|sed 's/ams./Amsterdam/;s/sgp./Singapore/;s/fra./Frankfurt/;s/tor./Toronto/;s/nyc./New York/;s/sfo./San Francisco/;s/lon./London/;s/blr./Bangalore/'`
    BANNER="$BANNER (DigitalOcean)"
  else
    BANNER=`hostname`
  fi
fi
if [ -z "$PUBLIC_IP" ]
then
  # Beautiful cross-platform one-liner cogged from:
  #   http://unix.stackexchange.com/questions/22615/how-can-i-get-my-external-ip-address-in-bash
  PUBLIC_IP=`dig +short myip.opendns.com @resolver1.opendns.com`
fi

# IP of the host machine.
# Useful because zork runs with --net=host.
HOST_IP=`ip -o -4 addr list docker0 | awk '{print $4}' | cut -d/ -f1`

# Start Zork, if necessary.
echo "CLOUD_INSTALL_STATUS_INSTALLING_UPROXY"
echo "CLOUD_INSTALL_PROGRESS 10"
if ! docker ps -a | grep uproxy-zork >/dev/null; then
  HOSTARGS=
  if [ "$PREBUILT" = true ]; then
    readonly GIT_ROOT=`git rev-parse --show-toplevel`
    HOSTARGS="$HOSTARGS -v $GIT_ROOT/build/src/lib/samples:/test/zork"
  fi
  # NET_ADMIN is required to run iptables inside the container.
  # Full list of capabilities:
  #   https://docs.docker.com/engine/reference/run/#runtime-privilege-linux-capabilities-and-lxc-configuration
  docker run --restart=always --net=host --cap-add NET_ADMIN $HOSTARGS --name uproxy-zork -d $ZORK_IMAGE /sbin/my_init -- /test/bin/load-zork.sh -z

  echo -n "Waiting for Zork to come up..."
  echo "CLOUD_INSTALL_STATUS_WAITING_FOR_UPROXY"
  echo "CLOUD_INSTALL_PROGRESS 50"
  while ! ((echo ping ; sleep 0.5) | nc -w 1 $HOST_IP 9000 | grep ping) > /dev/null; do echo -n .; done
  echo "ready!"
fi

# Start sshd, if necessary.
echo "CLOUD_INSTALL_STATUS_INSTALLING_SSH"
echo "CLOUD_INSTALL_PROGRESS 60"
if ! docker ps -a | grep uproxy-sshd >/dev/null; then
  # Add an /etc/hosts entry to the Zork container.
  # Because the Zork container runs with --net=host, we can't use the
  # regular, ever-so-slightly-more-elegant Docker notation.
  docker run --restart=always -d -p $SSHD_PORT:22 --name uproxy-sshd --add-host zork:$HOST_IP $SSHD_IMAGE > /dev/null
  docker exec uproxy-sshd sh -c "echo \"$BANNER\" > /banner"
  docker exec uproxy-sshd chmod 644 /banner
  docker exec uproxy-sshd sh -c "echo \"$PUBLIC_IP\" > /hostname"
  docker exec uproxy-sshd chmod 644 /hostname

  # Configure access.
  echo "CLOUD_INSTALL_STATUS_CONFIGURING_SSH"
  echo "CLOUD_INSTALL_PROGRESS 90"
  if [ -n "$AUTH_KEYS" ]
  then
    docker exec uproxy-sshd sh -c "echo $AUTH_KEYS | base64 -d  > /home/getter/.ssh/authorized_keys"
  else
    ISSUE_INVITE_ARGS=
    if [ "$AUTOMATED" = true ]
    then
      ISSUE_INVITE_ARGS="$ISSUE_INVITE_ARGS -a"
    fi
    if [ -n "$KEY" ]
    then
      ISSUE_INVITE_ARGS="$ISSUE_INVITE_ARGS -k $KEY"
    fi
    docker exec uproxy-sshd /issue_invite.sh $ISSUE_INVITE_ARGS
  fi
fi

echo "CLOUD_INSTALL_PROGRESS 100"
