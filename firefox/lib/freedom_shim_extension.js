/**
 * @constructor
 * @this {Freedom}
 * @param {freedomWindow} The window in which the freedom module resides
 */
var Freedom = function(freedomWindow) {
  console.log('Initializing freedom');

  var contextWindows = [];
  freedomWindow.port.on('freedom_shim', function(args) {
    for (var i = 0; i < freedom.contextWindows.length; i++) {
      freedom.contextWindows.port.emit('freedom_shim', args);
    }
  });
  var freedom = {
    addContentContext: function(context) {
      console.log('Adding context window to freedom');
      contextWindows.push(context);

      context.port.on("freedom_shim_listen", function(event) {
	console.log('fse received message from content to listen for event: ' + event);
	freedomWindow.port.emit("freedom_shim_listen", event);
      });

      context.port.on("freedom_shim", function(args) {
	console.log('fse received message from content for event: ' + args.event);
	freedomWindow.port.emit('freedom_shim', args);
      });
    }};
  return freedom;
};

exports.Freedom = Freedom;
