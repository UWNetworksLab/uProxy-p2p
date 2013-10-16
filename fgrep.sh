#!/bin/bash
find chrome common firefox scraps \( -type d -a \( -name tmp -o -name bower_components -o -name node_modules \) -prune \) -o \( -type f \( -name '*.js' ! -name freedom.js ! -name freedom.min.js \) -exec grep -n "$@" {} \; -printf "---- %p\n\n"  \) 
