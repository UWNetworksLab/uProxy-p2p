from SimpleHTTPServer import SimpleHTTPRequestHandler
import BaseHTTPServer
import sys

restricted_path = ''  # TODO: don't use global

class CORSRequestHandler(SimpleHTTPRequestHandler):
  def end_headers(self):
    self.send_header('Access-Control-Allow-Origin', '*')
    SimpleHTTPRequestHandler.end_headers(self)
  def do_GET(self):
    if self.path == restricted_path:
      return SimpleHTTPRequestHandler.do_GET(self)

if __name__ == '__main__':
  if len(sys.argv) != 3:
    print 'Usage: python logs-server.py <PORT> <RESTRICTED_PATH>'
  else:
    restricted_path = sys.argv[2]
    BaseHTTPServer.test(CORSRequestHandler, BaseHTTPServer.HTTPServer)
