'use strict';

// Shim for talking to FreeDOM, which is running as a content script
// in a separate page. Content scripts can only talk to the extension,
// and the extension can to everyone.
(function defineShim(global) {

  var callbacks = {};
  var id = window.location;

  addon.port.on("freedom_shim", function(args) {
    if (args.id == "FreeDOM" && (args.event in callbacks)) {
      callbacks[args.event](args.data);
    }
  });

  var freedom = {
    emit: function emit(event, data) {
      addon.port.emit("freedom_shim",
		      {event: event,
		       data: data,
		       id: id});
    },
    on: function on(event, callback) {
      callbacks[event] = callback;
      addon.port.emit("freedom_shim_listen", event);
    }
  };

  global.freedom = freedom;
})(window);

