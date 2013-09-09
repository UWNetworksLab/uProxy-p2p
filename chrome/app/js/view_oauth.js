/**
 * Hackety hack. Used by:
 *  - Google XMPP
 *  - Manual identity
 **/

var View_oauth = function(channel) {
  this.channel = channel;
  this.manualdialog = {};
  this.manualMsgQueue = {};
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
            success: true, 
            userId: resp.email, 
            message: {email: resp.email, token: token}
          });
        } else {
          this.dispatchEvent('message', {
            success: false,
            message: "Error validating oAuth token"
          });
        }
      }).bind(this), false);
      xhr.addEventListener('error', (function(evt) {
        this.dispatchEvent('message', {
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
  if (args && args.to && args.cmd && (args.cmd == 'manual-send' || args.cmd == 'manual-recv')) {
    this.createManualWindow(args.to);
    if (this.manualdialog[args.to]) {
      this.manualdialog[args.to].contentWindow.postMessage(args, "*");
    } else {
      if (this.manualMsgQueue[args.to]) {
        this.manualMsgQueue[args.to].push(args);
      } else {
        this.manualMsgQueue[args.to] = [args];
      }
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
View_oauth.prototype.createManualWindow = function(id) {
  chrome.app.window.create(
    'submodules/uproxy-common/identity/manual/manualdialog.html',
    {
      id: id,
      minWidth: 600,
      minHeight: 400,
      maxWidth: 600,
      maxHeight: 400
    },
    (function(id, child_win) {
      this.manualdialog[id] = child_win;
      this.manualdialog[id].onClosed.addListener((function(id) {
        delete this.manualdialog[id];
      }).bind(this, id));
      for (var key in this.manualMsgQueue[id]) {
        if (this.manualMsgQueue[id].hasOwnProperty(key)) {
          this.manualdialog[id].contentWindow.postMessage(this.manualMsgQueue[id][key], "*");
        }
      }
      this.manualMsgQueue[id] = [];
    }).bind(this, id)
  ); 
};

