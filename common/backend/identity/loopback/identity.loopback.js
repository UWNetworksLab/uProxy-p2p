var window = {};

function IdentityProvider() {
  console.log("Loopback Identity provider");
  this.status = 'offline';
  this.userId = 'Test User';
  this.profile = {
    me: {
      "Test User": {
        userId: "Test User",
        name: "Test User",
        clients: {'Test User.0': {
          'clientId':"Test User.0",
          'network': 'loopback',
          'status': "messageable"
        }}
      }
    },
    'roster': {
      "Other User": {
        userId: "Other User",
        name: "Other User",
        clients: {'Other User.0':{
          'clientId': "Other User.0", 
          'network': "loopback",
          'status': 'messageable'
        }}
      },
      'Johnny Appleseed': makeRosterEntry('Johnny Appleseed'),
      'Betty Boop': makeRosterEntry('Betty Boop'),
      'Big Bird': makeRosterEntry('Big Bird'),
      'Bugs Bunny': makeRosterEntry('Bugs Bunny'),
      'Daffy Duck': makeRosterEntry('Daffy Duck'),
      'Kermit the Frog': makeRosterEntry('Kermit the Frog'),
      'Minnie Mouse': makeRosterEntry('Minnie Mouse'),
      'Porky Pig': makeRosterEntry('Porky Pig'),
      'Swedish Chef': makeRosterEntry('Swedish Chef'),
      'Yosemite Sam': makeRosterEntry('Yosemite Sam')
    }
  };
  setTimeout((function() {
    this.dispatchEvent('onStatus', {
      userId: this.userId,
      network: 'loopback',
      status: this.status,
      message: "Woo!"
    });
  }).bind(this), 0);
}

var STATUSES = ['messageable', 'online', 'offline'];

function makeRosterEntry(userId, opts) {
  opts = opts || {};
  var entry = {
    userId: userId,
    name: opts.name || userId,
  };
  if (opts.clients) {
    entry.clients = opts.clients;
  } else {
    var clients = {};
    var nclients = userId.charCodeAt(0) % 3;
    for (var i=0; i<nclients; ++i) {
      var clientId = userId+'/-client'+i;
      clients[clientId] = {
        clientId: clientId,
        network: "loopback",
        status: STATUSES[i]
      };
    }
    entry.clients = clients;
  }
  return entry;
}

IdentityProvider.prototype.login = function(opts, continuation) {
  this.status = 'online';
  this.dispatchEvent('onStatus', {
    userId: this.userId,
    network: 'loopback',
    status: this.status,
    message: "Woo!"
  });
  this.dispatchEvent('onChange', this.profile.me[this.userId]);
  for (var id in this.profile.roster) {
    if (this.profile.roster.hasOwnProperty(id)) {
      this.dispatchEvent('onChange', this.profile.roster[id]);
    }
  }
  continuation();
};

IdentityProvider.prototype.getProfile = function(id, continuation) {
  //TODO get profiles for other users
  if (id == undefined) {
    continuation(this.profile);
  } else if (this.profile.me[id]) {
    continuation(this.profile);
  } else if (this.profile.roster[id]) {
    continuation({me: this.profile.roster[id], roster: {}});
  }
};

// Send a message to someone.
IdentityProvider.prototype.sendMessage= function(to, msg, continuation) {
  this.dispatchEvent('onMessage', {
    fromUserId: "Other User",
    fromClientId: "Other User.0", 
    toUserId: "Test User",
    toClientId: "Test User.0",
    message: msg
  });
  continuation();
};

IdentityProvider.prototype.logout = function(userId, networkName, continuation) {
  this.status = 'offline'; 
  this.dispatchEvent('onStatus', {
    userId: this.userId,
    network: 'loopback',
    status: this.status,
    message: 'Woo!'
  });
  continuation({
    userId: this.userId,
    success: true,
    message: 'Null logout process'
  });
};

var identity = freedom.identity();
identity.provideAsynchronous(IdentityProvider);
