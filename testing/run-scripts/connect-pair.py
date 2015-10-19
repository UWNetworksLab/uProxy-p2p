#!/usr/bin/python

import argparse
import select
import socket
import sys
import time

parser = argparse.ArgumentParser(description='Connect two Zork instances.')
parser.add_argument('getter_address', default='localhost',
                    help='getter address, e.g. localhost')
parser.add_argument('getter_port', type=int,
                    help='getter port, e.g. 9000')
parser.add_argument('giver_address', default='localhost',
                    help='getter address, e.g. localhost')
parser.add_argument('giver_port', type=int, default=9000,
                    help='getter port, e.g. 9010')
args = parser.parse_args()

getter = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
getter.connect_ex((args.getter_address, args.getter_port))
getter.setblocking(False)

giver = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
giver.connect((args.giver_address, args.giver_port))
giver.setblocking(False)

# Forward stdin to the getter, to allow commands such as
# port to configure the proxy.
if not sys.stdin.isatty():
  for line in sys.stdin:
    getter.sendall(line + '\n')

getter.sendall('get\n')
giver.sendall('give\n')

getterOpen = True
giverOpen = True
while getterOpen and giverOpen:
  inready, outready, exceptready = select.select([getter, giver], [], [])
  for s in inready:
    raw = s.recv(16384)
    if len(raw) < 1:
      if s == getter:
        getterOpen = False
      else:
        giverOpen = False
    else:
      for signal in raw.splitlines():
        if s == getter:
          giver.sendall(signal + '\n')
        else:
          getter.sendall(signal + '\n')
