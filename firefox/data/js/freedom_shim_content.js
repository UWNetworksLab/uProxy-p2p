'use strict';

// Shim for talking to FreeDOM, which is running as a content script
// in a separate page. Content scripts can only talk to the extension,
// and the extension can to everyone.

var freedomShim = function(id) {
    this.id = id;
    this.callbacks = {};

    addon.port.on("freedom_shim", function(args) {
	if (args.id == "FreeDOM" && (args.event in this.callbacks)) {
	    this.callbacks[args.event](args.data);
	}
    });
};

freedomShim.prototype.emit = function(event, data) {
    console.log('fsc Emitting message for event: ' + event);
    addon.port.emit("freedom_shim",
		    {event: event,
		     data: data,
		     id: this.id});
};

freedomShim.prototype.on = function(event, callback) {
    console.log('fsc listening for event: ' + event);
    this.callbacks[event] = callback;
    addon.port.emit("freedom_shim_listen", event);
};



