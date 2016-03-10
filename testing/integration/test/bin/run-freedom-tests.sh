#!/bin/bash

# Run script for pulling, building, and running tests in repositories

# Args: git repo url
function build_and_test () {
  cd /src
  git clone $1
  REPO=`basename $1`
  (cd $REPO; npm install && grunt test)
}



function reset_test () {  
  rm -rf /src/`basename $1`
  rm -rf /tmp/*
  # this will wait the port for 1 second; it waits for port to close 
  while netstat -t | grep localhost:8081 >/dev/null; do sleep 1; done
}

function setup_environment() {
  export DISPLAY=:10
  Xvfb :10 -screen 0 1280x1024x24 &
  sleep 3  # let Xvfb start up
}

setup_environment

for i in http://github.com/freedomjs/freedom-for-firefox http://github.com/freedomjs/freedom-for-chrome http://github.com/freedomjs/freedom-for-node

do
  REPO=`basename $i`
  echo "TRYING $REPO"
  TRIES=1
  SUCCEEDED=0
  while ((TRIES < 3 && SUCCEEDED == 0)); do
    if build_and_test $i
    then
      SUCCEEDED=1
    else
      TRIES=$((TRIES + 1))
      reset_test $i
    fi
  done
  if ((SUCCEEDED == 0)); then
    echo "FAILED ON $REPO AFTER 3 TRIES"
    exit 1
  fi
done


