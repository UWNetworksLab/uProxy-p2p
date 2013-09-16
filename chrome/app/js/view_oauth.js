/**
 * Hackety hack. Used by:
 *  - Google XMPP
 *  - Manual identity
 **/
var EXTENSION_ID = 'opedeinldpclhihojdgahbpjnndkfmhe';

var View_oauth = function(channel) {
  this.channel = channel;
  this.authMan = null;
  this.manualDialog = null;
};

View_oauth.prototype.open = function(args, continuation) {
  var file = args.file;
  if (file == "google") {
    this.authMan = new AuthGoogle((function(msg) {
      this.dispatchEvent('message', {
        cmd: 'auth',
        message: msg
      });
    }).bind(this));
  } else if (file == 'facebook') {
    this.authMan = new AuthFacebook((function(msg) {
      this.dispatchEvent('message', {
        cmd: 'auth',
        message: msg
      });
    }).bind(this));
  } else if (file == 'manual') {
    this.manualDialog = new ManualDialog((function(msg) {
      this.dispatchEvent('message', {
        cmd: 'manual-msg',
        message: msg
      });
    }).bind(this));
  } else {
    console.warn("Authentication view provider asked to serve unknown file: " + file);
  }
  continuation();
};

View_oauth.prototype.show = function(continuation) {
  continuation();
};

View_oauth.prototype.postMessage = function(args, continuation) {
  if (this.manualDialog && args && args.cmd && 
        (args.cmd == 'manual-send' || args.cmd == 'manual-recv')) {
    this.manualDialog.sendMessage(args);
  } else if (this.authMan && args && args.cmd && args.cmd == 'login') {
    this.authMan.login(args.interactive);
  } else {
    console.error("Unrecognized message to core.view: " + JSON.stringify(args));
  }
  continuation();
};

View_oauth.prototype.close = function(continuation) {
  continuation();
};

/**
 *INTERNAL METHODS
 */

  
