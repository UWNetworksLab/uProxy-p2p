#!/usr/bin/env sh

for dir in *
do
  if [ "`basename $0`" != "$dir" ]
  then
    cp -r ../lib/ $dir/oauth2/
    echo "Copied OAuth 2.0 library to $dir"
  fi
done
