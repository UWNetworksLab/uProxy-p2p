#!/bin/bash

if [ "$#" -ne 2 ]; then
  echo "Usage: flood.sh <size of download> <max. transfer rate>"
  echo "Examples:"
  echo "  10MB @ 500k/sec: flood.sh 10M 500k"
  echo "  1GB @ 1M/sec: flood.sh 1G 10M"
  exit 1
fi

ncat -l -k -p 1224 -c "dd if=/dev/zero count=1 bs=$1 status=none | pv -q -L $2"
