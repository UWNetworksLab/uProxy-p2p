/**
 * @constructor
 * @this {Freedom}
 * @param {freedomWindow} The window in which the freedom module resides
 */
var Freedom = function(freedomWindow) {
    this.freedomWindow = freedomWindow;
    this.contextWindows = [];
    freedomWindow.port.on('freedom_shim', function(args) {
	for (var i = 0; i < contextWindows.length; i++) {
	    contextWindows.port.emit('freedom_shim', args);
	}
    });
};

Freedom.prototype.addContentContext = function(context) {
    this.contextWindows.push(context);
    this.freedomWindow.port.on('freedom_shim', function(args) {
	this.freedomWindow.port.emit('freedom_shim', args);
    });
};

exports.Freedom = Freedom;
