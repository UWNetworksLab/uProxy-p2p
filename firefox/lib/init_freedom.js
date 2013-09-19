'use strict';

var self = require("sdk/self");
var pageWorker = require("sdk/page-worker");
var FreedomCommunicator = require("./freedom_shim_extension").FreedomCommunication;
var FreedomSocketManager = require("./freedom_socket_manager").FreedomSocketManager;

// Initialize freedom backgroun page.
// TODO: Ensure this is a singleton.
var InitFreedom = function() {
  const freedomPageWorker = pageWorker.Page({
    contentURL: self.data.url("freedom-page-worker.html")
  });

  const freedomCommunicator = FreedomCommunicator(freedomPageWorker);
  const sockets = FreedomSocketManager(freedomPageWorker);
  const freedomEnvironment = {communicator: freedomCommunicator,
			      sockets: sockets};
  Object.freeze(freedomEnvironment);
  return freedomEnvironment;
};

exports.InitFreedom = InitFreedom;
