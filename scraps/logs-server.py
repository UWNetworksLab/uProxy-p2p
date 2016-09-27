from SimpleHTTPServer import SimpleHTTPRequestHandler
import BaseHTTPServer
import sys

restricted_file = ''  # TODO: don't use global
access_token = ''  # TODO: don't use global

class CORSRequestHandler(SimpleHTTPRequestHandler):
  def end_headers(self):
    self.send_header('Access-Control-Allow-Origin', '*')
    SimpleHTTPRequestHandler.end_headers(self)
  def do_GET(self):
    if self.path == restricted_file + '/accessToken=' + access_token:
      return SimpleHTTPRequestHandler.do_GET(self)
    else:
      return self.wfile.write('cannot access path %s' % (self.path))

if __name__ == '__main__':
  if len(sys.argv) != 4:
    print 'Usage: python logs-server.py <PORT> <FILE> <ACCESS_TOKEN>'
  else:
    restricted_file = sys.argv[2]
    access_token = sys.argv[3]
    BaseHTTPServer.test(CORSRequestHandler, BaseHTTPServer.HTTPServer)
