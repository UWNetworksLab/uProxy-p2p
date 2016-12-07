#!/bin/bash
cleanup=0
case "$1" in
  -c)
	  cleanup=1
	  shift
	  ;;
esac

dockerid=${1:?'Docker ID hash must be provided as sole argument'}
pid=$(docker inspect -f '{{.State.Pid}}' $dockerid)

addrmask=$(ip addr show docker0 | perl -ane 'if ($_ =~ /inet /) { print $F[1],"\n"; }')

# docker0 address
addr=$(echo "$addrmask" | sed 's,/.*,,')

# network mask bit count
mask=$(echo "$addrmask" | sed 's,.*/,,')

# docker internal -- just always use 99
daddr=$(echo "$addrmask" | sed 's,[0-9]*/[0-9]*,99,')

# network part of addr
naddr=$(echo "$addrmask" | sed 's,[0-9]*/[0-9]*,0,')

case "$cleanup" in
  0)
    echo "Making /var/run/netns/$pid"
	  sudo mkdir -p /var/run/netns
	  sudo ln -s /proc/$pid/ns/net /var/run/netns/$pid

    echo "Making veth devices"
	  sudo ip link add A type veth peer name B
	  sudo brctl addif docker0 A
	  sudo ip link set A up

	  ethaddr=$(dd if=/dev/urandom count=6 bs=1 status=none | od -t x1 | cut -d ' ' -f 2- | head -1 | tr ' ' :)
    echo "Setting ethernet address $ethaddr"
	  sudo ip link set B netns $pid
	  sudo ip netns exec $pid ip link set dev B name eth0
	  sudo ip netns exec $pid ip link set eth0 address 01:23:45:67:89:ab
	  sudo ip netns exec $pid ip link set eth0 up
	  sudo ip netns exec $pid ip addr add $daddr/$mask dev eth0
	  sudo ip netns exec $pid ip route add default via $addr

    echo "Setting up NAT."
	  sudo iptables -t nat -A POSTROUTING -s $naddr/$mask -j MASQUERADE
	  ;;
  1)
	  sudo rm /var/run/netns/$pid
	  sudo iptables -t nat -D POSTROUTING -s $naddr/$mask -j MASQUERADE
	  ;;
esac
