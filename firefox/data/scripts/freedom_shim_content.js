'use strict';

// Shim for talking to FreeDOM, which is running as a content script
// in a separate page. Content scripts can only talk to the extension,
// and the extension can to everyone.
(function defineShim(global) {

  var callbacks = {};
  var id = "None";
  var communicator = addon;

  // The way messages are passed depends on where this script is
  // running, so we need to detect the proper way to pass messages.
  if ((typeof communicator) === "undefined") {
    if(self) {
      console.log("Shim is in a user script, using 'self' for message passing");
      communicator = self;
    } else if(document && document.defaultView) {
      console.log("Shim is in a web page, using 'document.defaultView' for message passing");
      communicator = {
  	port:{
  	  emit: document.defaultView.postMessage,
  	  on: document.defaultView.addEventListener
      }};
    }
  } else {
    console.log("Shim is in a panel, using 'addon' for message passing");
  }

  communicator.port.on("freedom_shim", function(args) {
    if (args.id == "FreeDOM" && (args.event in callbacks)) {
      callbacks[args.event](args.data);
    }
  });

  var freedom = {
    emit: function emit(event, data) {
      communicator.port.emit("freedom_shim",
		      {event: event,
		       data: data,
		       id: id});
    },
    on: function on(event, callback) {
      callbacks[event] = callback;
      communicator.port.emit("freedom_shim_listen", event);
    }
  };

  global.freedom = freedom;
})(this);

