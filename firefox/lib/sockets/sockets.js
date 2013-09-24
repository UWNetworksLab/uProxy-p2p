'use strict';

const { Class } = require('sdk/core/heritage');
const { ClientSocket } = require('./client_sockets');
const { ServerSocket } = require('./server_sockets');


var copyFunctions = function(source, destination) {
  for (let prop in source) {
    if (isFunction(source[prop])) {
      destination[prop] = function () {
	source[prop].apply(source, arguments);
      };
    }
  }
};

var Socket = Class({
  
});

// exports.Socket = Socket;
exports.ClientSocket = ClientSocket;
exports.ServerSocket = ServerSocket;
