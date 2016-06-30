#!/bin/bash
#Create the zipped folder needed for CWS.

rm uproxy.zip
mkdir uproxy
cp *.js *.html manifest.json uproxy/
cp -r images uproxy/
zip -0 -r uproxy.zip uproxy uproxy/*
rm -r uproxy
