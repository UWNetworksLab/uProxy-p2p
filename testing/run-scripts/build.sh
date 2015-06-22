#!/bin/bash
if ! [ -f ./Dockerfile ] ; then echo "Wrong directory.  Run from directory with the dockerfile you want." ; exit 1; fi

sudo docker build -t uproxy/bash .
