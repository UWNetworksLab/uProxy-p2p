#!/bin/bash
find . \( -type d -a \( -name bower_components -o -name node_modules \) -prune \) -o \( -type f \( -name '*.js' ! -name freedom.js ! -name freedom.min.js \) -exec grep -n "$@" {} \; -printf "---- %p\n\n"  \) 
