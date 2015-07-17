#!/bin/bash

# Sets or clears latency on a container's virtual ethernet device.
# Wraps tc netem, in a 'ip netns exec tc netem'.

source "${BASH_SOURCE%/*}/utils.sh" || (echo "cannot find utils.sh" && exit 1)
echo "Looking up docker id $1"
prepare_docker_pid $1
DPID=$(docker_pid $1)
shift

echo sudo ip netns exec $DPID tc $*
sudo ip netns exec $DPID tc $*
