#!/bin/bash

cd /home/vagrant/node_modules/node-xmpp
sudo apt-get install libicu-dev
#Make sure you're on node.js stable (or add --nodedir= to npm)
/usr/local/bin/npm install browserify-override
/usr/local/bin/npm install . || :
cd ..
cp -r /vagrant/chrome-support/* ./
cd node-xmpp
/usr/local/bin/browserify -p browserify-override -o node-xmpp-browser.js -r request:browser-request -i node-stringprep lib/node-xmpp-browserify.js
cp node-xmpp-browser.js /vagrant/
