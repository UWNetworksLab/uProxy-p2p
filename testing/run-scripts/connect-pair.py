#!/usr/bin/python

# Connects two SOCKS adventure instances running on localhost.
# TODO: add host/port args.

import select
import socket

getter = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
getter.connect_ex(('localhost', 9000))
getter.setblocking(False)

giver = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
giver.connect(('localhost', 9010))
giver.setblocking(False)

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
