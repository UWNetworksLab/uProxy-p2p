'use strict';

// Shim for talking to FreeDOM, which is running as a content script
// in a separate page. Content scripts can only talk to the extension,
// and the extension can to everyone.

var freedomShim = function(id) {
    this.id = id;
    this.callbacks = {};

    addon.port.on("freedom_shim", function(args) {
	if (args.id == "freedom" && (args.event in this.callbacks)) {
	    this.callbacks[args.event](args.data);
	}
    });
};

fdomShim.prototype.emit = function(event, data) {
    addon.port.emit("freedom_shim",
		    {event: event,
		     data: data,
		     id: this.id});
};

fdomShim.prototype.on = function(event, callback) {
    this.callbacks[event] = callback;
};



