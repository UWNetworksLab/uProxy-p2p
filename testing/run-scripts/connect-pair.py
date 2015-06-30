#!/usr/bin/python

# Connects two copy-paste samples running on localhost.
# TODO: add host/port args.

import socket
import time

first = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
first.connect(("localhost", 9000))

second = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
second.connect(("localhost", 9010))

print "Connecting to 9000"
first.send("GET\n")
time.sleep(1.0)
first_sdp = first.recv(4096)
print "Connecting to 9010, sending " + first_sdp
second.send("GIVE " + first_sdp + "\n")
time.sleep(1.0)
second_sdp = second.recv(4096)
print "From second, got " + second_sdp
first.send(second_sdp)
print "Sent to first."
