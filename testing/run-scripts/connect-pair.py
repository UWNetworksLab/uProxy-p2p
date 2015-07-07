#!/usr/bin/python

# Connects two copy-paste samples running on localhost.
# TODO: add host/port args.

import socket
import time

getter = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
getter.connect(("localhost", 9000))
getter_sock = getter.makefile()

giver = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
giver.connect(("localhost", 9010))
giver_sock = giver.makefile()

print "connecting to getter"
getter_sock.write("GET\n")
getter_sock.flush()
time.sleep(3.0)
offer_sdp = getter_sock.readline().rstrip()
print "connecting to giver, sending " + offer_sdp
giver_sock.write("GIVE " + offer_sdp + "\n")
giver_sock.flush()
time.sleep(3.0)
answer_sdp = giver_sock.readline().rstrip()
print "from giver, got " + answer_sdp
getter_sock.write(answer_sdp)
print "sent to getter"
