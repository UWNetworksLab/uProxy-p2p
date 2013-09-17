'use strict';

// Shim for talking to FreeDOM, which is running as a content script
// in a separate page. Content scripts can only talk to the extension,
// and the extension can to everyone.
(function defineShim(global) {

  var callbacks = {};
  var id = "None";
  var communicator;

  // The way messages are passed depends on where this script is
  // running, so we need to detect the proper way to pass messages.
 if ((typeof addon) !== "undefined") {
   console.log("Shim is in a panel, using 'addon' for message passing");
   communicator = addon;
 } else if ((typeof self) !== "undefined" &&
	   (typeof self.port) !== "undefined") {
   console.log("Shim is in a user script, using 'self' for message passing");
   communicator = self;
 } else if((typeof window) !== "undefined") {
   console.log("Shim is in a web page, using 'window' for message passing");
   communicator = {
     port: {
       emit: function(event, data) {
	 window.postMessage({event: event, data: data},
			    "resource://uproxyfirefox-at-universityofwashington");

       },
       on: function(event, target) {
	 window.addEventListener("message", function(windowEvent) {
	   if (windowEvent.event === event) {
	     target(windowEvent.data);
	   }
	 });
       }
     }};
 } else {
   throw "No communication channel.";
 }
  

  communicator.port.on("freedom_shim", function(args) {
    if (args.id == "FreeDOM" && (args.event in callbacks)) {
      callbacks[args.event](args.data);
    }
  });

  var freedom = {
    emit: function emit(event, data) {
      console.log("emitting event" + event);
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

