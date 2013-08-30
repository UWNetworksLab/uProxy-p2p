var View_oauth = function(channel) {
  this.channel = channel;
  this.manualdialog = null;
  this.manualMsgQueue = [];
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
  } else if (file == 'manualdialog.html') {
    chrome.app.window.create(
      'submodules/uproxy-common/identity/manual/manualdialog.html',
      {
        id: 'manualdialog',
        minWidth: 600,
        minHeight: 400,
        maxWidth: 600,
        maxHeight: 400
      },
      (function(child_win) {
        this.manualdialog = child_win;
        for (var i=0; i<this.manualMsgQueue.length; i++) {
          this.manualdialog.postMessage(this.manualMsgQueue[i]);
        }
        this.manualMsgQueue = [];
        this.manualdialog.onClosed(function() {
          this.manualdialog = null;
        });
      }).bind(this)
    ); 
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
}

View_oauth.prototype.postMessage = function(args, continuation) {
  if (this.manualdialog) {
    this.manualdialog.postMessage(args);
  } else {
    this.manualMsgQueue.push(args);
  }
  continuation();
}

View_oauth.prototype.close = function(continuation) {
  continuation();
}
