'use strict';

const { isFunction } = require('sdk/lang/type');

const { Class } = require('sdk/core/heritage');
const { ClientSocket } = require('./client_sockets');
const { ServerSocket } = require('./server_sockets');
const { EventTarget } = require("sdk/event/target");

const SERVERTYPE = 'server';
const CLIENTTYPE = 'client';

/**
 * The Socket class impliments both socket interfaces, but ultimately
 * can only act as one type of socket. Socket exists to simplify the
 * freedom socket manager, by allowing the manager to create a socket
 * object before it knows what type of socket the client needs.
 */
var Socket = Class({
  type: 'Socket',
  // Even though Socket implements both, Socket can only act as one socket type.
  implements: [ClientSocket, ServerSocket],
  extends: EventTarget,
  intialize: function initialize() {},
  listen: function listen(address, port) {
    ServerSocket.prototype.initialize.call(this, address, port);
    ServerSocket.prototype.listen.call(this);
    this.socketType = SERVERTYPE;
  },
  connect: function connect(hostname, port) {
    ClientSocket.prototype.initialize.call(this);
    ClientSocket.prototype.connect.call(this, hostname, port);
    this.socketType = CLIENTTYPE;
  },
  getInfo: function getInfo() {
    if (this.socketType === CLIENTTYPE) {
      return ClientSocket.prototype.getInfo.call(this);
    }
    return ServerSocket.prototype.getInfo.call(this);
  }
});

exports.Socket = Socket;
exports.ClientSocket = ClientSocket;
exports.ServerSocket = ServerSocket;
