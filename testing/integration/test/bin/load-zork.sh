#!/bin/bash

. /etc/test.conf

RUNVNC=false
FOREVER=false
LISTEN=false
CLONEARGS=
CLONESRC=https://github.com/uProxy/uproxy-lib.git
PREBUILT=false
NPM=false
IPTABLES=false
while getopts b:r:nlpvz:h? opt; do
    case $opt in
        b)
            CLONEARGS="$CLONEARGS -b $OPTARG"
            ;;
        r)
            CLONESRC=$OPTARG
            ;;
        p)
            PREBUILT=true
            ;;
        n)
            NPM=true
            ;;
        v)
            RUNVNC=true
            ;;
        l)
            LISTEN=true
            ;;
        z)
            IPTABLES=$OPTARG
            ;;
        *)
            echo "$0 [-b branch] [-r repo] [-z true|false] [-n] [-l] [-p] [-v] [-h]"
            echo "  -b: BRANCH is the branch to checkout instead of HEAD's referant."
            echo "  -r: REPO is the repository to clone instead of github.com/uProxy/uproxy-lib."
            echo "  -n: install uproxy-lib from npm (overrides -b, -r, and -p)"
            echo "  -l: wait until the extension is listening."
            echo "  -p: use a pre-built uproxy-lib repo (overrides -b and -r)."
            echo "  -v: run a vncserver (port 5900 in the instance)"
            echo "  -z: restrict access to port 9000 via iptables (default: false)"
            echo "  -h, -?: this help message"
            exit 1;
            ;;
    esac
done

# Overlap X startup with our download and build.
pkill Xvfb
rm -f /tmp/.X10-lock
export DISPLAY=:10
Xvfb :10 -screen 0 1280x1024x24 &
fvwm &

if [ $RUNVNC = true ]; then
    x11vnc -display :10 -forever &
fi

if [ $PREBUILT = false ]; then
    mkdir -p /test/src
    cd /test/src
    if [ $NPM = true ]; then
        npm install --prefix /test/src uproxy-lib
        ln -s /test/src/node_modules/uproxy-lib /test/src/uproxy-lib
        cd uproxy-lib
    else
        npm install -g bower grunt-cli
        echo git clone $CLONEARGS $CLONESRC
        git clone $CLONEARGS $CLONESRC
        cd uproxy-lib
        ./setup.sh install
        grunt zork
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
