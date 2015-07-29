# Update uProxy version in all relevant places.
#
# Run with:
# python version.py <new version>
# e.g. python version.py 0.8.10

import sys

files = [
          'src/chrome/app/dist_build/manifest.json',
          'src/chrome/app/dev_build/manifest.json',
          'src/chrome/extension/dist_build/manifest.json',
          'src/chrome/extension/dev_build/manifest.json',
          'src/firefox/package.json',
          'package.json',
          'bower.json',
        ]

for filename in files:
  lines = []
  with open(filename) as infile:
    for line in infile:
        versionPos = line.find("\"version\":")
        versionLen = len("\"version\":")
        if versionPos != -1:
            line = line[:versionPos+versionLen] + " \"" + sys.argv[1] + "\",\n"
        lines.append(line)
  with open(filename, 'w') as outfile:
    for line in lines:
      outfile.write(line)
