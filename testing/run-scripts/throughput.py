#!/usr/bin/python

import argparse
import csv
import subprocess
import sys
import time
import urllib

import StringIO

FLOOD_SIZE_MB = 20
FLOOD_MAX_SPEED = '5M'

parser = argparse.ArgumentParser(description='Measure SOCKS proxy throughput across browser versions.')
parser.add_argument('clone_path', help='path to pre-built uproxy-lib repo')
args = parser.parse_args()

# Where is flood server?
flood_ip = subprocess.check_output('./flood.sh ' + str(FLOOD_SIZE_MB) + ' ' + FLOOD_MAX_SPEED, shell=True).strip()
print '** using flood server at ' + flood_ip

browsers = ['chrome', 'firefox']
versions = ['stable', 'beta', 'canary']

# Run the benchmarks.
throughput = {}
for browser in browsers:
  for version in versions:
    print '** ' + browser + '/' + version

    # Start the relevant config, stopping the previous one if necessary.
    # TODO: check first if running, to avoid spurious warnings
    subprocess.call(['docker', 'rm', '-f', 'uproxy-getter', 'uproxy-giver'])
    # TODO: use python 3.3+ timeouts
    spec = browser + '-' + version
    subprocess.call('./run_pair.sh -p ' + args.clone_path + ' ' + spec + ' ' + spec, shell=True)

    # time.time is good for Unix-like systems.
    start = time.time()
    subprocess.call(['nc', '-X', '5', '-x', 'localhost:9999', flood_ip, '1224'])
    end = time.time()

    elapsed = round(end - start, 2)
    throughput[browser, version] = int((FLOOD_SIZE_MB / elapsed) * 1000)

    print '** throughput for ' + browser + '/' + version + ': ' + str(throughput[browser, version]) + 'K/sec'

# Raw summary.
print '** raw numbers: ' + str(throughput)

# CSV, e.g.:
#   throughput,stable,beta,canary
#   chrome,200,250,400
#   firefox,500,500,600
stringio = StringIO.StringIO()
writer = csv.writer(stringio)
headers = ['throughput']
headers.extend(versions)
writer.writerow(headers)
for browser in browsers:
  row = [browser]
  for version in versions:
    row.append(throughput[browser, version])
  writer.writerow(row)
print '** CSV'
print stringio.getvalue()

# URL which uses Datacopia's oh-so-simple GET-based API:
print '** http://www.datacopia.com/?data=' + urllib.quote(stringio.getvalue())
