#!/bin/bash

# Outputs some interesting stats from a zork log.

# TODO: this is preposterously slow
# TODO: mean negotiation time
# TODO: mean connection length

set -e

function usage () {
  echo "$0 [-h] logfile"
  exit 1
}

while getopts h? opt; do
  case $opt in
    *) usage ;;
  esac
done
shift $((OPTIND-1))

if [ $# -lt 1 ]
then
  usage
fi

# Split on newlines, for easy looping through log lines.
IFS="
"
num_sessions=0
num_giving_attempts=0
num_giving_successes=0
for opening in `grep ^zork $1|grep 'new client from'`
do
  num_sessions=$((num_sessions+1))
  # ID includes a trailing :.
  session_id=`echo $opening|cut -d" " -f 4`
  if grep -q -i -m 1 "^zork.*$session_id.*received command: give" $1; then
    num_giving_attempts=$((num_giving_attempts+1))
    echo -n "$session_id "
    if grep -q -i -m 1 "^zork.*$session_id.*rtctonet connected" $1; then
      echo "SUCCESS"
      num_giving_successes=$((num_giving_successes+1))  
    elif grep -q -i -m 1 "^zork.*$session_id.*failed to start rtctonet" $1; then
      echo "FAILED"
      echo "***"
      grep $session_id $1
      echo "***"
    else
      echo "unknown"
    fi
  fi
done
percent_successes=`echo "scale=2;(($num_giving_successes/$num_giving_attempts)*100)"|bc`
echo "$num_sessions proxying sessions, $num_giving_successes of $num_giving_attempts attempts to give access succeeded ($percent_successes%)"
