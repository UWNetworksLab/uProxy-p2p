var CREDENTIALS_KEY = "xmpp-credentials-mvav24n24ovp48"

function AuthXmpp(cb) {
  this.credentialsCallback = cb;
  this.credentials = {
    userId: null,
    token: null
  };
  this.dialogWindow= null;
};

AuthXmpp.prototype.login = function(interactive) {
  chrome.storage.get(CREDENTIALS_KEY, (function(data) {
    if (data && data[CREDENTIALS_KEY] && data[CREDENTIALS_KEY] !== null) {
      this.credentialsCallback(data[CREDENTIALS_KEY]);
      return;
    } else if (interactive) {
      this.createDialog();
    } else {
      console.error('XMPP provider authentication: Credentials not cached and interactive is off');
    }
  }).bind(this));
};

AuthXmpp.prototype.logout = function() {
  chrome.storage.remove(CREDENTIALS_KEY);
};

/*** 
 * INTERNAL METHODS
 **/

AuthXmpp.prototype.createDialog = function() {
  chrome.app.window.create(
    'dialogs/xmpp-auth/xmpp-auth.html',
    {
      id: 'xmpp-auth',
      minWidth: 600,
      minHeight: 400,
      maxWidth: 600,
      maxHeight: 400
    },
    (function(child_win) {
      this.dialogWindow = child_win;
      this.dialogWindow.onClosed.addListener((function() {
        this.dialogWindow = null;
        chrome.storage.get(CREDENTIALS_KEY, (function(data) {
          if (data && data[CREDENTIALS_KEY] && data[CREDENTIALS_KEY] !== null) {
            this.credentialsCallback(data[CREDENTIALS_KEY]);
            return;
          } else {
            console.error('XMPP provider authentication: No credentials provided into dialog window');
          }
        }).bind(this));
      }).bind(this));
    }).bind(this)
  ); 

};


