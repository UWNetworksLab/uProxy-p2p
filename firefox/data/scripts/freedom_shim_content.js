'use strict';

// Shim for talking to FreeDOM, which is running as a content script
// in a separate page. Content scripts can only talk to the extension,
// and the extension can to everyone.
(function defineShim(global) {

  var callbacks = {};
  var id = 'FreeDOMShim@NOID';
  var communicator;
  if ((typeof self) !== 'undefined' &&
      (typeof self.location) !== 'undefined') {
    id = 'FreeDOMShim@' + self.location.href;
  } else if ((typeof href) !== 'undefined') {
    id = 'FreeDOMShim@' + href;
  }

  // The way messages are passed depends on where this script is
  // running, so we need to detect the proper way to pass messages.
 if ((typeof addon) !== 'undefined') {
   console.log(id + ' Shim is in a panel, using "addon" for message passing');
   communicator = addon;
 } else if ((typeof self) !== 'undefined' &&
	   (typeof self.port) !== 'undefined') {
   console.log(id + ' Shim is in a user script, using "self" for message passing');
   communicator = self;
 } else if((typeof window) !== 'undefined') {
   console.log(id + ' Shim is in a web page or content script, using eventShim for message passing');
   if ((typeof eventShim) === 'undefined') {
     throw new ReferenceError('eventShim has not been defined.');
   }
   communicator = {
     port: eventShim
   };
 } else {
   throw 'No communication channel.';
 }
  
  communicator.port.on('freedom_shim', function incomingEvent(args) {
    if (args.event in callbacks) {
      console.log(id + ' receiving event ' + args.event +
		  ' through communication channel, calling registered listeners.');
      var eventCallbacks = callbacks[args.event];
      for (var i = 0; i < eventCallbacks.length; i++) {	
	eventCallbacks[i](args.data);
      }
    }
  });

  var freedom = {
    emit: function emit(event, data) {
      console.log(id + ' emit called on event: ' + event);
      communicator.port.emit('freedom_shim_hub',
		      {event: event,
		       data: data,
		       id: id});
    },
    on: function on(event, callback) {
      console.log(id + ' listening for event: ' + event);
      if (callbacks[event]) {
	console.log(id + ' adding to callbacks for ' + event);
	callbacks[event].push(callback);
      } else {
	console.log(id + ' new event registered, creating new callback array for ' + event);
	callbacks[event] = [callback];
      }
      communicator.port.emit('freedom_shim_listen', event);
    }
  };

  global.freedom = freedom;
})(this);

