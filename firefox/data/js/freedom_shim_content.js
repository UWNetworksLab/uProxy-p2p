'use strict';

// Shim for talking to FreeDOM, which is running as a content script
// in a separate page. Content scripts can only talk to the extension,
// and the extension can to everyone.
// TODO: create function that doesn't require 'new' keyword.
var freedomShim = function(id) {
  console.log('loading freedom shim');
  this.id = id;
  this.callbacks = {};
  callbacks = this.callbacks;

  addon.port.on("freedom_shim", function(args) {
    if (args.id == "FreeDOM" && (args.event in callbacks)) {
      callbacks[args.event](args.data);
    }
  });
  console.log('freedom shim constructed');
};

freedomShim.prototype.emit = function(event, data) {
    addon.port.emit("freedom_shim",
		    {event: event,
		     data: data,
		     id: this.id});
};

freedomShim.prototype.on = function(event, callback) {
    this.callbacks[event] = callback;
    addon.port.emit("freedom_shim_listen", event);
};



