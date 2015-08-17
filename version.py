#!/usr/bin/env python
# Update uProxy version in all relevant places.
#
# Run with:
# python version.py <new version>
# e.g. python version.py 0.8.10

import json
import collections
import sys
import re

manifest_files = [
          'src/chrome/app/manifest.json',
          'src/chrome/extension/manifest.json',
          'src/firefox/package.json',
          'package.json',
          'bower.json',
        ]

if len(sys.argv) < 2:
  print 'Missing version number. Usage: python version.py <new version>'
  sys.exit()
else:
  validVersion = re.match('[0-9]+\.[0-9]+\.[0-9]+', sys.argv[1])
  if validVersion == None:
    print 'Please enter a valid version number.'
    sys.exit()

for filename in manifest_files:
  print filename
  with open(filename) as manifest:
    manifest_data = json.load(manifest, object_pairs_hook=collections.OrderedDict)
    manifest_data['version'] = sys.argv[1]
  with open(filename, 'w') as dist_manifest:
    json.dump(manifest_data, dist_manifest, indent=2, separators=(',', ': '))
    dist_manifest.write('\n');
