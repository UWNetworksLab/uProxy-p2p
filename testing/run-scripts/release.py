#!/usr/bin/python3

import argparse
import itertools
import subprocess

parser = argparse.ArgumentParser(
    description='Cross-browser tests for uproxy-lib release process.')
parser.add_argument('clone_path', help='path to pre-built uproxy-lib repo')
args = parser.parse_args()

browsers = ['chrome', 'firefox']
versions = ['stable', 'beta', 'canary']

test_url = 'http://www.example.com/'

# Compute a hash of the page without using any proxy.
match = subprocess.check_output(
    'curl ' + test_url + ' 2>/dev/null|md5sum -|cut -d\' \' -f1',
    shell=True,
    universal_newlines=True).strip()
print('** known md5sum: ' + match)

# Iterate through every browser/version combination.
results = {}
combos = [('-'.join(x)) for x in itertools.product(browsers, versions)]
for getter_spec, giver_spec in itertools.product(combos, combos):
  print('** ' + getter_spec + ' <- ' + giver_spec)

  passed = False
  try:
    # Start the relevant config, stopping the previous one if necessary.
    # TODO: check first if running, to avoid spurious warnings
    subprocess.call(['docker', 'rm', '-f', 'uproxy-getter', 'uproxy-giver'])
    subprocess.call(['./run_pair.sh', '-p', args.clone_path,
        getter_spec, giver_spec], timeout=15)

    md5sum = subprocess.check_output(
        'curl -x socks5h://localhost:9999 ' + test_url + ' 2>/dev/null|md5sum -|cut -d\' \' -f1',
        shell=True,
        universal_newlines=True).strip()
    print('** md5sum: ' + md5sum)

    passed = (md5sum == match)
    print('** ' + str(passed))
  except Exception as e:
    print('** failure for ' + getter_spec + ' <- ' + giver_spec + ': ' + str(e))

  results[getter_spec, giver_spec] = passed

# Raw summary.
print('** raw results: ' + str(results))

# Markdown.
# TODO: Output a URL to show this (requires an online Markdown viewer
#       that accepts a GET request...couldn't find one).
print('** markdown (rows are getter, columns the giver)')
# emoji reference:
#   http://www.emoji-cheat-sheet.com/
success_emoji = ':white_check_mark:'
failure_emoji = ':x:'
# headers...
headers = ['*']
headers.extend(combos)
print(' | '.join(headers))
# bars... (required for Github markdown to treat this as a table)
print('---: | ' + ' | '.join(itertools.repeat(':---:', len(combos))))
# data...
for getter_spec in combos:
  cols = [getter_spec]
  for giver_spec in combos:
    cols.append(success_emoji if results[getter_spec, giver_spec] else failure_emoji)
  print(' | '.join(cols))
