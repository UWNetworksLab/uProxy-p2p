function loadSupport() {
  chrome = {
    socket: freedom['core.socket']()
  };
  
  console.warn = function(f) {
    console.log(f);
  }

  window = {};

  importScripts('node-xmpp-browser.js');
  importScripts('xmppDaemon.js');
}

function IdentityProvider() {
  if (typeof XmppDaemon == "undefined") {
    loadSupport();
  }
  this.credentials = null;
  this.client = null;
}

// Get my id.
IdentityProvider.prototype.getProfile = function(continuation) {
  if (!this.credentials) {
    var view = freedom['core.view']();
    var promise = view.open({
      file: "view.html"
    });
    promise.done(function() {
      view.show();
    });

    var retVal = false;
    view.on('close', function() {
      if (retVal === false) {
        continuation({});
      }
    });

    view.on('message', function(identity) {
      view.close();
      var sanitized_email = identity.email.toLowerCase().trim();
      this.credentials = sanitized_email;
      continuation({me: this.credentials});
    }.bind(this));
  } else {
    continuation({me: this.credentials});
  }
};

// Send a message to someone.
IdentityProvider.prototype.send = function(to, msg, continuation) {
  continuation();
}

var identity = freedom.identity();
identity.provideAsynchronous(IdentityProvider);
