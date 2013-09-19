// Part of FreeDOM shim that allows FreeDOM to talk to other scripts
// and allows scripts to listen to events from FreeDOM.

(function(global) {
  var freedom = global.freedom;
  var id = "FreeDOMHub@NOID";
  if ((typeof self) !== 'undefined' &&
      (typeof self.location) !== 'undefined') {
    id = 'FreeDOMShim@' + self.location.href;
  } else if ((typeof href) !== 'undefined') {
    id = 'FreeDOMShim@' + href;
  }

  global.freedomShim = {
    addCommunicator: function addCommunicator(communicator) {

      communicator.on("freedom_shim", function(args) {
	console.log(id + ' incomming message message for event: ' + args.event);
	freedom.emit(args.event, args.data);
      });
      
      // Another script wants to listen to events from FreeDOM, so we
      // start listening to freedom for that event.
      communicator.on("freedom_shim_listen", function(event) {
	console.log(id + ' now listening for: ' + event);
	freedom.on(event, function(freedomOutput) {
	  var args = {event: event,
		      data: freedomOutput,
		      id: id};
	  communicator.emit("freedom_shim", args);
	});
      });

      // Release the reference to communicator by referencing a dummy object. 
      communicator.on('detach', function removeCommunicator() {
	// We mock the communicator so that events that used to go to
	// this communicator are now a no-op.  We may want to fix this
	// later so that a no-op functions don't accumulate.
	communicator = {
	    emit: function emit() {}
	};
      });
    }
  };
}(this));
