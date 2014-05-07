#!/bin/bash
# Starts a simple http server to run the uistatic.
# Navigate to localhost:8855 to play with it.
# Must be run from the root directory. e.g.
# uProxy/> tools/uistatic.sh
echo 'Starting static UI...'
cd build/uistatic
python -m http.server 8855
cd -
