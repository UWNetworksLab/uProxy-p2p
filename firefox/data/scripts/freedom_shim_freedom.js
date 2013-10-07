'use strict';

// Part of FreeDOM shim that allows FreeDOM to talk to other scripts
// and allows scripts to listen to events from FreeDOM.

(function(global) {
  var freedom = global.freedom;
  var id = "FreeDOMHub@NOID";
  if ((typeof self) !== 'undefined' &&
      (typeof self.location) !== 'undefined') {
    id = 'FreeDOMHub@' + self.location.href;
  } else if ((typeof href) !== 'undefined') {
    id = 'FreeDOMHub@' + href;
  }

  if ((typeof freedom) === 'undefined') {
    console.warn(id + ' freedom is undefined. Messages may not get delivered.');
    console.log('global is:\n' + Object.keys(global));
  }

  global.freedomShim = {
    addCommunicator: function addCommunicator(communicator) {
      console.log('Adding communicator to ' + id);
      communicator.on("freedom_shim_hub", function(args) {
	console.log(id + ' incomming message message for event: ' + args.event +
		   ', passing event on to freedom');
	freedom.emit(args.event, args.data);
      });
      
      // Another script wants to listen to events from FreeDOM, so we
      // start listening to freedom for that event.
      communicator.on("freedom_shim_listen", function(event) {
	console.log(id + ' now listening for: ' + event);
	freedom.on(event, function(freedomOutput) {
	  if (communicator === null) return;
	  console.log(id + ' received event for: ' + event +
		      ' from freedom, sending on to communicator.');
	  var args = {event: event,
		      data: freedomOutput,
		      id: id};
	  try {
	    communicator.emit("freedom_shim", args);
	  } catch (e) {
	    // This may occur when the resource (eg Worker) is destroyed.
	    // null this reference to prevent memory leaks.
	    communicator = null;
	  }
	});
      });
    }
  };
}(this));
