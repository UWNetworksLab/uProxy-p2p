#!/usr/bin/python

# Connects two copy-paste samples running on localhost.
# TODO: add host/port args.

import socket
import time

getter = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
getter.connect(("localhost", 9000))

giver = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
giver.connect(("localhost", 9010))

print "connecting to getter"
getter.send("GET\n")
time.sleep(1.0)
offer_sdp = getter.recv(4096)
print "connecting to giver, sending " + first_sdp
giver.send("GIVE " + offer_sdp + "\n")
time.sleep(1.0)
answer_sdp = giver.recv(4096)
print "from giver, got " + second_sdp
getter.send(answer_sdp)
print "sent to getter"
