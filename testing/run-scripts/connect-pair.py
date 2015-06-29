#!/usr/bin/python

# Connects two copy-paste samples running on localhost.
# TODO: add host/port args.

import socket
import time

first = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
first.connect(("localhost", 9000))

second = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
second.connect(("localhost", 9010))

first.send("GET\n")
time.sleep(1.0)
first_sdp = first.recv(4096)
second.send("GIVE " + first_sdp + "\n")
time.sleep(1.0)
second_sdp = second.recv(4096)
first.send(second_sdp)
