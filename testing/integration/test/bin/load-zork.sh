#!/bin/bash

. /etc/test.conf

RUNVNC=false
IPTABLES=false

function usage () {
  echo "$0 [-p] [-z] [-h]"
  echo "  -v: run a vncserver (port 5900 in the instance)"
  echo "  -z: restrict access to port 9000 via iptables"
  echo "  -h, -?: this help message"
  exit 1;
}

while getopts vzh? opt; do
  case $opt in
    v)
      RUNVNC=true
      ;;
    z)
      IPTABLES=true
      ;;
    *)
      ;;
  esac
done

if [ "$BROWSER" = "chrome" ] || [ "$BROWSER" = "firefox" ]
then
  pkill Xvfb
  rm -f /tmp/.X10-lock
  export DISPLAY=:10
  Xvfb :10 -screen 0 1280x1024x24 &
  fvwm &

  if [ "$RUNVNC" = true ]; then
    x11vnc -display :10 -forever &
  fi
fi

if [ "$IPTABLES" = true ]
then
  if ! iptables -v -L INPUT|grep 9000|grep docker0 >/dev/null
  then
    # Restrict access to zork to connections originating from
    # localhost and our own Docker containers. Note that doing
    # this inside a Docker container is *VERY WEIRD* and
    # potentially *DANGEROUS*. However, we do it on cloud
    # because the Zork container runs with --net=host and
    # without this, Zork's command port would remain publically
    # accessible.
    iptables -A INPUT -p tcp -i lo --dport 9000 -j ACCEPT
    iptables -A INPUT -p tcp ! -i docker0 --dport 9000 -j REJECT
  fi
fi

/usr/bin/supervisord -n -c /test/etc/supervisord-$BROWSER.conf
