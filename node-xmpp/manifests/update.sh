#!/bin/bash

cd /home/vagrant/node_modules/node-xmpp
/usr/local/bin/npm install browserify-override
cd ..
cp -r /vagrant/chrome-support/* ./
cd node-xmpp
/usr/local/bin/browserify -p browserify-override -o node-xmpp-browser.js lib/node-xmpp-browserify.js
cp node-xmpp-browser.js /vagrant/