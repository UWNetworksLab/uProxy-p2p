#!/usr/bin/python3

import argparse
import csv
import io
import subprocess
import sys
import time
import urllib.parse

FLOOD_SIZE_MB = 64
FLOOD_MAX_SPEED = '5M'

parser = argparse.ArgumentParser(
    description='Measure SOCKS proxy throughput across browser versions.')
parser.add_argument('clone_path', help='path to pre-built uproxy-lib repo')
args = parser.parse_args()

# Where is flood server?
flood_ip = subprocess.check_output(['./flood.sh', str(FLOOD_SIZE_MB) + 'M',
    FLOOD_MAX_SPEED], universal_newlines=True).strip()
print('** using flood server at ' + str(flood_ip))

browsers = ['chrome', 'firefox']
versions = ['stable', 'beta', 'canary']

# Run the benchmarks.
throughput = {}
for browser in browsers:
  for version in versions:
    print('** ' + browser + '/' + version)

    result = 0
    try:
      spec = browser + '-' + version
      # Start the relevant config.
      subprocess.call(['./run_pair.sh', '-p', args.clone_path, spec, spec],
          timeout=15)

      # time.time is good for Unix-like systems.
      start = time.time()
      if subprocess.call(['nc', '-X', '5', '-x', 'localhost:9999',
          flood_ip, '1224']) != 0:
        raise Exception('nc failed, proxy probably did not start')
      end = time.time()

      elapsed = round(end - start, 2)
      result = int((FLOOD_SIZE_MB / elapsed) * 1000)

      print('** throughput for ' + browser + '/' + version + ': ' +
          str(result) + 'KB/sec')
    except Exception as e:
      print('** failed to test ' + browser + '/' + version + ': ' + str(e))

    throughput[browser, version] = result

# Raw summary.
print('** raw numbers: ' + str(throughput))

# CSV, e.g.:
#   throughput,stable,beta,canary
#   chrome,200,250,400
#   firefox,500,500,600
stringio = io.StringIO()
writer = csv.writer(stringio)
headers = ['throughput']
headers.extend(versions)
writer.writerow(headers)
for browser in browsers:
  row = [browser]
  for version in versions:
    row.append(throughput[browser, version])
  writer.writerow(row)
print('** CSV')
print(stringio.getvalue())

# URL which uses Datacopia's oh-so-simple GET-based API:
print('** http://www.datacopia.com/?data=' + urllib.parse.quote(
    stringio.getvalue()))
