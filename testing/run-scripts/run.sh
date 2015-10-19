#!/bin/bash

NUM=1
TASK=bash
RUNARGS="-i"
while getopts n:t:d opt; do
  case $opt in
	  n)
          NUM=$OPTARG
          ;;
      t)
          TASK=$OPTARG
          ;;
      d)
          RUNARGS="-d"
          ;;
      *)
          echo "$0 [-n NUM] [-t TASK] [-d]"
          echo "  -n: Instance number NUM.  Port numbers are offset by this much."
          echo "  -t: Task named TASK.  One of: bash, zork"
          echo "  -d: Run docker image as daemon (pass -d to docker run)"
          exit 1;
          ;;
  esac
done

shift $((OPTIND-1))
[[ $1 = "--" ]] && shift

CONTROLPORT=$((9000 + (10 * ($NUM - 1))))
PROXYPORT=$((9998 + $NUM))
VNCPORT=$((5899 + $NUM))

echo trying control port $CONTROLPORT and proxy port $PROXYPORT 
echo sudo docker run -p ${CONTROLPORT}:9000 -p ${PROXYPORT}:9999 -p ${VNCPORT}:5900 ${RUNARGS} -t uproxy/${TASK} $*
sudo docker run -p ${CONTROLPORT}:9000 -p ${PROXYPORT}:9999 -p ${VNCPORT}:5900 ${RUNARGS} -t uproxy/${TASK} $*
