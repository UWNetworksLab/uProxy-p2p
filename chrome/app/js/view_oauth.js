/**
 * Hackety hack. Used by:
 *  - Google XMPP
 *  - Manual identity
 **/

var View_oauth = function(channel) {
  this.channel = channel;
  this.manualdialog = null;
  this.manualport = null;
  this.manualMsgQueue = [];
  chrome.runtime.onConnect.addListener(this.onConnect.bind(this));
};

View_oauth.prototype.open = function(args, continuation) {
  var file = args.file;
  if (file == "googlelogin.html") {
    //chrome.app.window.create('submodules/uproxy-common/identity/google/googlelogin.html', {});
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
}

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
}

View_oauth.prototype.close = function(continuation) {
  continuation();
}

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

View_oauth.prototype.onConnect = function(port) {
  if (port.name !== 'manualdialog') {
    console.error("Unexpected internal port connection from " + port.sender.id);
    return;
  } else if (this.manualport) {
    console.error("Port to manual dialog already exists");
    return;
  }
  this.manualport = port;
  this.manualport.onMessage.addListener(this.onMessage.bind(this));
  for (var i=0; i < this.manualMsgQueue.length; i++) {
    this.manualport.postMessage(this.manualMsgQueue[i]);
  }
  this.manualMsgQueue = [];
};

View_oauth.prototype.onMessage = function(msg) {
  this.dispatchEvent('message', {
    cmd: 'manual-msg',
    message: msg
  });
};
