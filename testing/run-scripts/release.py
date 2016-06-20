#!/usr/bin/python

# Part of the uProxy release process:
#   https://github.com/uProxy/uproxy
# Currently, this performs two important tests on every
# getter/giver combination of the stable, beta, and canary
# releases of Chrome and Firefox:
#  1. download http://www.example.com/, via curl
#  2. transfer a 16MB file, via ncat
# In both cases, the transferred data is checksummed
# against a "known good" transfer.
# At the end, the results are output as a table in Markdown
# format, suitable for inclusion in Github release notes.

import argparse
import itertools
import subprocess

parser = argparse.ArgumentParser(
    description='Cross-browser tests for uproxy release process.')
parser.add_argument('clone_path', help='path to pre-built uproxy-lib repo')
parser.add_argument('--browsers', help='browsers to test', nargs='+', default=['chrome', 'firefox'])
parser.add_argument('--versions', help='browser versions to test', nargs='+', default=['stable', 'beta', 'canary'])
args = parser.parse_args()

test_url = 'http://www.example.com/'

# Compute a hash of the page without using any proxy.
known_small_md5sum = subprocess.check_output(
    'curl ' + test_url + ' 2>/dev/null|md5sum -|cut -d\' \' -f1',
    shell=True,
    universal_newlines=True).strip()
print('** small download known md5sum: ' + known_small_md5sum)

# Where is flood server?
FLOOD_SIZE_MB = 1
FLOOD_MAX_SPEED = '5M'
flood_ip = subprocess.check_output(['./flood.sh', str(FLOOD_SIZE_MB) + 'M',
    FLOOD_MAX_SPEED], universal_newlines=True).strip()
print('** using flood server at ' + str(flood_ip))

subprocess.call('nc ' + flood_ip + ' 1224 > /tmp/nc', shell=True)
known_large_md5sum = subprocess.check_output(
    'cat /tmp/nc|md5sum -|cut -d\' \' -f1',
    shell=True,
    universal_newlines=True).strip()
print('** large transfer known md5sum: ' + known_large_md5sum)

# Iterate through every browser/version combination.
results = {}
combos = [('-'.join(x)) for x in itertools.product(args.browsers, args.versions)]
for getter_spec, giver_spec in itertools.product(combos, combos):
  passed = False
  try:
    # Start the browsers.
    print('** ' + getter_spec + ' <- ' + giver_spec)
    subprocess.call(['docker', 'rm', '-f', 'uproxy-getter', 'uproxy-giver'])
    subprocess.call(['./run_pair.sh', '-p', args.clone_path, getter_spec, giver_spec])

    # small HTTP download.
    small_md5sum = subprocess.check_output(
        'curl -x socks5h://localhost:9999 ' + test_url + ' 2>/dev/null|md5sum -|cut -d\' \' -f1',
        shell=True,
        universal_newlines=True).strip()
    print('** small download md5sum: ' + small_md5sum)
    passed = (small_md5sum == known_small_md5sum)

    # large (non-HTTP) transfer.
    if subprocess.call('nc -X 5 -x localhost:9999 ' + flood_ip + ' 1224 > /tmp/nc',
        shell=True) != 0:
      raise Exception('nc failed, proxy probably did not start')
    large_md5sum = subprocess.check_output(
        'cat /tmp/nc|md5sum -|cut -d\' \' -f1',
        shell=True,
        universal_newlines=True).strip()
    print('** large transfer md5sum: ' + large_md5sum)
    passed = passed and (large_md5sum == known_large_md5sum)

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
