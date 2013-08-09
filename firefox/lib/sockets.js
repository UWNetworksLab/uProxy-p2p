'use strict';

const { Cc, Ci, CC, Cr } = require('chrome');
const { ByteReader, ByteWriter } = require('sdk/io/byte-streams');

const socketTransportService = Cc["@mozilla.org/network/socket-transport-service;1"].getService(Ci.nsISocketTransportService);

var ClientSocket = function() {
  var transport;
  var reader;
  var writer;
  var socket = {
    connect: function(hostname, port) {
      if ((typeof transport) !== 'undefined') {
	throw 'Socket already connected';
      }
      transport = socketTransportService.createTransport(null, 0,
							 hostname, port, null);
      // Requires new, unlike the rest of the Jetpack API
      // See https://bugzilla.mozilla.org/show_bug.cgi?id=902222
      reader = new ByteReader(transport.openInputStream(0,0,0));
      writer = new ByteWriter(transport.openOutputStream(0,0,0));
    },
    read: function(numBytes, callback) {
      return reader.read(numBytes);
    },
    write: function(data) {
      writer.write(data);
    },
    disconnect: function() {
      reader.close();
      writer.close();
      transport.close(0);
    }
  };
  return socket;
};

exports.ClientSocket = ClientSocket;
