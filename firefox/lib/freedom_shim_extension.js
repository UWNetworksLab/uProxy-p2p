/**
 * @param {freedomWindow} The window in which the freedom module resides
 */
var FreedomCommunication = function(freedomWindow) {
  var contextWindows = [];
  freedomWindow.port.on('freedom_shim', function(args) {
    for (var i = 0; i < contextWindows.length; i++) {
      contextWindows[i].port.emit('freedom_shim', args);
    }
  });
  var freedom = {
    addContentContext: function(context) {
      console.log('Adding context window to freedom');
      contextWindows.push(context);

      context.port.on("freedom_shim_listen", function(event) {
	freedomWindow.port.emit("freedom_shim_listen", event);
      });

      context.port.on("freedom_shim", function(args) {
	freedomWindow.port.emit('freedom_shim', args);
      });
    }};
  return freedom;
};

exports.FreedomCommunication = FreedomCommunication;
