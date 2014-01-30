#!/bin/sh

REMOTE=$1
BASE=$2

scp -r chrome-support manifests $REMOTE:$BASE/node-xmpp/
ssh $REMOTE "cd $BASE/node-xmpp/; export PATH='/opt/vagrant/bin:/bin:/usr/bin:/usr/local/bin'; bash update.sh"
scp $REMOTE:$BASE/node-xmpp/node-xmpp-browser.js ../
