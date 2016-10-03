# Python script to create a webserver which serves only 1 file over HTTP
# (uncrypted), and returns a 404 error for all other requests.
# Designed for serving uProxy cloud install logs to monitor install progress,
# but can be re-used for other purposes.
#
# Usage: python logs-server.py <PORT> <FILE>
#   e.g. python logs-server.py 8000 /directory/file

from SimpleHTTPServer import SimpleHTTPRequestHandler
import BaseHTTPServer
import sys

class SingleFileRequestHandler(SimpleHTTPRequestHandler):
  restricted_file = ''
  def end_headers(self):
    # Allow HTTP requests to come from any origin.
    self.send_header('Access-Control-Allow-Origin', '*')
    SimpleHTTPRequestHandler.end_headers(self)
  def do_GET(self):
    # Only serve the restricted file.
    if self.path != SingleFileRequestHandler.restricted_file:
      return self.send_response(404)
    return SimpleHTTPRequestHandler.do_GET(self)

if __name__ == '__main__':
  if len(sys.argv) != 3:
    print 'Usage: python logs-server.py <PORT> <FILE>'
  else:
    port = int(sys.argv[1])
    address = ('', port)
    SingleFileRequestHandler.restricted_file = sys.argv[2]
    server = BaseHTTPServer.HTTPServer(address, SingleFileRequestHandler)
    server.serve_forever()
