// Part of FreeDOM shim that allows FreeDOM to talk to other scripts
// and allows scripts to listen to events from FreeDOM.

(function(global) {
  var freedom = global.freedom;

  global.freedomShim = {
    addCommunicator: function addCommunicator(communicator) {
      communicator.port.on("freedom_shim", function(args) {
	console.log('incomming message message for event: ' + args.event);
	freedom.emit(args.event, args.data);
      });
      
      // Another script wants to listen to events from FreeDOM, so we
      // start listening to freedom for that event.
      communicator.port.on("freedom_shim_listen", function(event) {
	console.log('Now listening for: ' + event);
	freedom.on(event, function(freedomOutput) {
	  var args = {event: event,
		      data: freedomOutput,
		      id: "FreeDOM"};
	  communicator.port.emit("freedom_shim", args);
	});
      });
    }
  };
}(this));
