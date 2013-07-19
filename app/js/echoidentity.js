function IdentityProvider() {
  this.client = null;
}

IdentityProvider.prototype.getProfile = function(id, continuation) {
  continuation({
    card: {
      'id': 'me@gmail.com',
      'name': 'Me',
      'imageUrl': '',
      'status': 'available'
    },
    roster: {
      'alice@gmail.com': {
        'id': 'alice@gmail.com',
        'name': 'Alice',
        'imageUrl': '',
        'status': 'away'
      },
      'bob@gmail.com': {
        'id': 'bob@gmail.com',
        'name': 'Bob',
        'imageUrl': '',
        'status': 'available'
      },
      'eve@gmail.com': {
        'id': 'eve@gmail.com',
        'name': 'Eve',
        'imageUrl': '',
        'status': 'offline'
      }
    }
  });
};

// Send a message to someone.
IdentityProvider.prototype.sendMessage = function(to, msg, continuation) {
  this.dispatchEvent('onMessage', {from: '', message: msg});
  continuation();
}

var identity = freedom.identity();
identity.provideAsynchronous(IdentityProvider);
