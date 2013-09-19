const { Cc, Ci, CC, Cr } = require('chrome');
const { Class } = require('sdk/core/heritage');
var { EventTarget } = require("sdk/event/target");
let { emit } = require('sdk/event/core');
const { isUndefined, isNumber, isFunction } = require('sdk/lang/type');
const { ByteReader, ByteWriter } = require('sdk/io/byte-streams');

let serverSockets = new WeakMap();
let waitingConnections = new WeakMap();
let waitingAccepts = new WeakMap();

function serverSocketFor(socket) serverSockets.get(socket)
function waitingConnectionsFor(socket) waitingConnections.get(socket)
function waitingAcceptsFor(socket) waitingAccepts.get(socket)

var ServerSocket = Class({
  type: 'ServerSocket',
  extends: EventTarget,
  // Address is currently ignored
  initialize: function initialize(address, port, backlog) {
    if (!isNumber(backlog)) {
      backlog = -1;
    }
    var nsiServerSocket = Cc["@mozilla.org/network/server-socket;1"]
          .createInstance(Ci.nsIServerSocket);
    nsiServerSocket.init(port, 0, backlog);
    nsiServerSocket.put(this, serverSocket);
    waitingConnections.put(this, []);
  },
  listen: function listen() {
    let serverSocket = serverSocketFor(this);
    serverSocket.asyncListen(nsIServerSocketListener(this));
  },
  disconnect: function disconnect() {
    serverSocketFor(this).close();
  }
});
