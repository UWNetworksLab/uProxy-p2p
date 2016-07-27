#!/bin/bash

###
# DO NOT CALL THIS SCRIPT DIRECTLY -- see testing/run-scripts/flood.sh
###

ncat -l -k -p 1224 -c "dd if=/dev/zero count=1 bs=$1 status=none"
