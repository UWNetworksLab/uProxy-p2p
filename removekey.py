# Remove key from Chrome manifest
#
# Run with:
# python removekey.py

import json

manifest_files = [
                   'build/dist/chrome/app/manifest.json',
                   'build/dist/chrome/extension/manifest.json'
                 ]

for filename in manifest_files:
  with open(filename) as manifest:
    manifest_data = json.load(manifest)
    del manifest_data['key']
  with open(filename, 'w') as dist_manifest:
    json.dump(manifest_data, dist_manifest, indent=2)
