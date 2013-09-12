#!/bin/sh

git clone https://github.com/astro/node-xmpp.git
cd node-xmpp
npm install

cd ..
cp node_modules/package.json node-xmpp/
cp -r node_modules/freedom* node-xmpp/node_modules/

#todo(willscott): get the browserify dependency local
#right now you need to run 'npm install -g browserify' for this step to work.
cd node-xmpp
browserify -d -o node-xmpp-browser.js ./lib/node-xmpp-browserify.js
cd ..

cp node-xmpp/node-xmpp-browser.js ../
