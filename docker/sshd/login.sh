#!/bin/bash

# Run on login, via the command option in authorized_keys.

# Report the server description.
if [ "$SSH_ORIGINAL_COMMAND" == "cat /banner" ]
then
  cat /banner
else
  echo "unrecognised command"
  exit 1
fi
