/**
 * Hackety hack. Used by:
 *  - Google XMPP
 *  - Manual identity
 **/
var EXTENSION_ID = 'opedeinldpclhihojdgahbpjnndkfmhe';

var View_oauth = function(channel) {
  this.channel = channel;
  this.manualdialog = null;
  this.manualport = null;
  this.manualMsgQueue = [];
  this.authPort = {
    'google-auth': null,
    'facebook-auth': null
  };
  this.designation = null;
  chrome.runtime.onConnect.addListener(this.onConnectManual.bind(this));
  chrome.runtime.onConnectExternal.addListener(this.onConnectAuth.bind(this));
};

View_oauth.prototype.open = function(args, continuation) {
  var file = args.file;
  if (file == "googlelogin.html") {
    //chrome.app.window.create('submodules/uproxy-common/identity/google/googlelogin.html', {});
    this.designation = 'google-auth';
    chrome.identity.getAuthToken({ 'interactive': true }, (function(token) {
      var xhr = new XMLHttpRequest();
      xhr.addEventListener('load', (function(evt) {
        if (xhr.status == 200) {
          var resp = JSON.parse(xhr.responseText);
          this.dispatchEvent('message', {
            cmd: 'google-auth',
            success: true, 
            userId: resp.email, 
            message: {email: resp.email, token: token}
          });
        } else {
          this.dispatchEvent('message', {
            cmd: 'google-auth',
            success: false,
            message: "Error validating oAuth token"
          });
        }
      }).bind(this), false);
      xhr.addEventListener('error', (function(evt) {
        this.dispatchEvent('message', {
          cmd: 'google-auth',
          success: false,
          message: "Error occurred while validating oAuth token"
        });
      }).bind(this), false);
      xhr.open('get', 'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token='+token, true);
      xhr.send();
    }).bind(this));
  } else if (file == 'manual') {
    this.designation = 'manual';
  } else if (file == "oauth.html") {
    //@TODO{ryscheng} Get rid of this block
    if (!this.listening) {
      this.listening = true;
      freedom.on('oauth', this.dispatchEvent.bind(this,'message'));
    }
    continuation();
  } else {
    console.warn("Authentication view provider asked to serve unknown file: " + file);
    this.dispatchEvent('message', {
      cmd: 'google-auth',
      success: false,
      message: "Authentication view provider asked to serve unknown file: "+file
    });
    continuation();
  }
};

View_oauth.prototype.show = function(continuation) {
  continuation();
};

View_oauth.prototype.postMessage = function(args, continuation) {
  if (args && args.cmd && (args.cmd == 'manual-send' || args.cmd == 'manual-recv')) {
    this.createManualWindow();
    if (this.manualport) {
      this.manualport.postMessage(args);
    } else {
      this.manualMsgQueue.push(args);
    }
  }
  continuation();
};

View_oauth.prototype.close = function(continuation) {
  continuation();
};

/**
 *INTERNAL METHODS
 */
View_oauth.prototype.createManualWindow = function() {
  chrome.app.window.create(
    //'submodules/uproxy-common/identity/manual/manualdialog.html',
    'manualidentity/manualdialog.html',
    {
      id: 'manual',
      minWidth: 600,
      minHeight: 400,
      maxWidth: 600,
      maxHeight: 400
    },
    (function(child_win) {
      this.manualdialog = child_win;
      this.manualdialog.onClosed.addListener((function() {
        if (this.manualport) {
          this.manualport.disconnect();
          this.manualport = null;
        }
        this.manualdialog = null;
      }).bind(this));
    }).bind(this)
  ); 
};

View_oauth.prototype.onConnectManual = function(port) {
  if (port.name !== 'manualdialog') {
    console.error("Unexpected internal port connection from " + port.sender.id);
    return;
  } else if (this.manualport) {
    console.error("Port to manual dialog already exists");
    return;
  } else if (this.designation !== 'manual') {
    console.log('Port to core.view for something else');
    return;
  }
  this.manualport = port;
  this.manualport.onMessage.addListener(this.onMessageManual.bind(this));
  this.manualport.onDisconnect.addListener((function() {
    this.manualport = null;
  }).bind(this));
  for (var i=0; i < this.manualMsgQueue.length; i++) {
    this.manualport.postMessage(this.manualMsgQueue[i]);
  }
  this.manualMsgQueue = [];
};

View_oauth.prototype.onMessageManual = function(msg) {
  this.dispatchEvent('message', {
    cmd: 'manual-msg',
    message: msg
  });
};

View_oauth.prototype.onConnectAuth = function(port) {
  if (!this.authPort.hasOwnProperty(port.name)) {
    console.log("Unexpected external port connection with name "+port.name);
    return;
  } else if (port.sender.id !== EXTENSION_ID) {
    console.error("Unexpected external port connection from "+port.sender.id);
    return;
  } else if (port.name !== this.designation) {
    console.log('Got connection request from ' + port.name + " for core.view for " + this.designation);
    return;
  }
  this.authPort[port.name] = port;
  port.onDisconnect.addListener((function() {
    this.authPort[port.name] = null;
  }).bind(this));
  port.onMessage.addListener(this.onMessageAuth.bind(this));
};

View_oauth.prototype.onMessageAuth = function (msg) {
  console.log('!!!' + JSON.stringify(msg));
};
