function loadSupport() {
  chrome = {
    socket: freedom['core.socket']()
  };
  
  console.warn = function(f) {
    console.log(f);
  }

  window = {};

  importScripts('/node-xmpp-browser.js');
  importScripts('/xmppDaemon.js');
}

function IdentityProvider() {
  if (typeof XmppDaemon == "undefined") {
    loadSupport();
  }
}

// Get my id.
IdentityProvider.prototype.get = function(continuation) {
  continuation({"id": "me"});
}

// Send a message to someone.
IdentityProvider.prototype.send = function(to, msg, continuation) {
  continuation();
}

var identity = freedom.identity();
identity.provideAsynchronous(IdentityProvider);
