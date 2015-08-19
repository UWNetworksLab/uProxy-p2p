#!/bin/bash

# Sets MTU on a container's virtual ethernet device.
# Wraps ip link set dev $IFACE mtu $1, in a 'ip netns exec'.

source "${BASH_SOURCE%/*}/utils.sh" || (echo "cannot find utils.sh" && exit 1)
echo "Looking up docker id $1"
prepare_docker_pid $1
DPID=$(docker_pid $1)
shift

IFACE=eth0

echo sudo ip netns exec $DPID ip link set dev $IFACE mtu $*
sudo ip netns exec $DPID ip link set dev $IFACE mtu $*
