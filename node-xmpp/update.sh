#!/bin/sh

# Startup includes a full compilation if the VM is
# not yet created.
STATUS=`vagrant status | grep "running"`
if [ -z "$STATUS" ];
then
  vagrant up
	exit
fi

vagrant ssh -c "sudo bash /vagrant/manifests/update.sh"