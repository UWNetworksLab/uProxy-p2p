function IdentityProvider() {
// late bound importScripts() available.
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
