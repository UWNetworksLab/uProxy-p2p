var window = {};

/**
 * IdentityProvider handles the individual identities for each network.
 */
function IdentityProvider() {
  window.current = this;
  console.log('Meta Identity Provider');
  this.profile = {
    me: {},
    roster: {}
  };
  this.reverseIndex = {};
  this.providers = {
    loopback: {
      ref: freedom.loopbackIdentity(),
      status: 'offline',
      userId: null,
      network: 'loopback'
    },
    manual: {
      ref: freedom.manualIdentity(),
      status: 'offline',
      userId: null,
      network: 'manual'
    },
    google: {
      ref: freedom.googleIdentity(),
      status: 'offline',
      userId: null,
      network: 'google'
    },
    facebook: {
      ref: freedom.facebookIdentity(),
      status: 'offline',
      userId: null,
      network: 'facebook'
    }
  };
  //Register listeners
  for (var key in this.providers) {
    if (this.providers.hasOwnProperty(key)) {
      this.providers[key].ref.on('onStatus', (function(key, data) {
        this.onStatus(data, key);
      }).bind(this, key));
      this.providers[key].ref.on('onChange', (function(key, data) {
        this.onChange(data, key);
      }).bind(this, key));
      this.providers[key].ref.on('onMessage', (function(key, data) {
        this.onMessage(data, key);
      }).bind(this, key));
    }
  }
};

IdentityProvider.prototype.login = function(opts, continuation) {
  if (opts.network && this.providers[opts.network]) {
    this.providers[opts.network].ref.login(opts);
  } else if (opts.network) {
    console.error('Invalid network name: '+opts.network);
  } else {
    for (var key in this.providers) {
      if (this.providers.hasOwnProperty(key)) {
        this.providers[key].ref.login(opts);
      }
    }
  }
  continuation();
};

IdentityProvider.prototype.getProfile = function(id, continuation) {
  if (id == undefined) {
    continuation(this.profile);
  } else if (this.profile.me[id]) {
    continuation(this.profile);
  } else if (this.profile.roster[id]) {
    continuation({me: this.profile.roster[id], roster: {}});
  }
};

// Send a message to someone.
IdentityProvider.prototype.sendMessage = function(to, msg, continuation) {
  if (this.reverseIndex[to]) {
    var key = this.reverseIndex[to];
    this.providers[key].ref.sendMessage(to, msg).done(function(ret) {
      continuation(ret);
    });
  } else {
    console.log("Error: identity provider missing for contact: " + to);
  }
};

IdentityProvider.prototype.logout = function(userId, networkName, continuation) {
  var results = {};
  var providerCount = 0;
  for (var key in this.providers) {
    if (this.providers.hasOwnProperty(key)) {
      if ((userId == undefined && networkName == undefined) || 
          this.providers[key].userId == userId ||
          this.providers[key].network == networkName) {
        providerCount += 1;
        this.providers[key].ref.logout(userId, networkName).done(function(data) {
          results[key] = data;
          var success = true;
          var message = '';
          var resultCount = 0;
          for (var rk in results) {
            if (results.hasOwnProperty(rk)) {
              success &= results[rk].success;
              message += results[rk].message + ";";
              resultCount += 1;
            }
          }
          if (resultCount == providerCount) {
            continuation({
              success: success,
              message: message
            });
          }
        });
      }
    }
  }

};

/**
 * INTERNAL METHODS
 **/
IdentityProvider.prototype.onStatus = function(data, providerKey) {
  this.providers[providerKey].status = data;
  console.log(providerKey + " - " + JSON.stringify(data));
  //if (providerKey == 'google') {
    this.dispatchEvent('onStatus', data);
  //}
  if (data.userId) {
    this.providers[providerKey].userId = data.userId;
    if (!this.profile.me[data.userId]) {
      this.profile.me[data.userId] = {userId: data.userId};
    }
  }
};

IdentityProvider.prototype.onChange = function(data, providerKey) {
  //Record the provider for each userId and clientId
  if (!this.reverseIndex[data.userId]) {
    this.reverseIndex[data.userId] = providerKey;
  }
  for (var id in data.clients) {
    if (data.clients.hasOwnProperty(id) && !this.reverseIndex[id]) {
      this.reverseIndex[id] = providerKey;
    }
  }
  //Add manual client
  var manualId = 'manual://' + data.userId;
  if (!data.clients) {
    data.clients = {};
  }
  data.clients[manualId] = {
    clientId: manualId,
    network: 'manual',
    status: 'messageable'
  };
  this.reverseIndex[manualId] = 'manual';
  //Cache the card in the local profile
  if (data.userId && this.profile.me[data.userId]) {
    this.profile.me[data.userId] = data;
  } else { //must be a buddy
    this.profile.roster[data.userId] = data;
  }
  this.dispatchEvent('onChange', data);
};

IdentityProvider.prototype.onMessage = function(data, providerKey) {
  if (data.fromUserId && data.fromClientId && data.toUserId && data.toClientId) {
    this.dispatchEvent('onMessage', data);
  } else {
    this.dispatchEvent('onMessage', data);
    console.log(data.message);
  }
};

var identity = freedom.identity();
identity.provideAsynchronous(IdentityProvider);
