/*globals window, require, forge*/
var XMLHttpRequest = require('freedom-xhr').corexhr;
var DigitalOcean = require('do-wrapper');

var STATUS_CODES = {
  "START": "Starting provisioner",
  "OAUTH_INIT": "Initializing oauth flow",
  "OAUTH_ERROR": "Error getting oauth token",
  "OAUTH_COMPLETE": "Got oauth token",

};

var REDIRECT_URIS = [
  "https://kmnjcbmibpajfljogomikcdlmhgpnolg.chromiumapp.org"
  //  "http://localhost:10101"
];

/**
 * from a digital ocean networks descriptor object, return the
 * array of accessible IP addresses.
 */
var QUERY_IP_TIMER = 1;  // TODO: Set a maximum timeout to reject promise?
function queryIpAddress(client, dropletId) {
  'use strict';
  var deferred = Q.defer();

  function _queryIpAddress() {
    client.dropletsGetById(dropletId, function (err, res, body) {
      // Extract IP addresses from the networks property
      var networks = body.droplet.networks;
      var addrs = [];
      Object.keys(networks).forEach(function (type) {
        networks[type].forEach(function (address) {
          if (address.type === "public" && address.ip_address) {
            addrs.push(address.ip_address);
          }
        });
      });

      // Retry after timeout if there are no IPs, otherwise fulfill with IP array
      if (addrs.length === 0) {
        setTimeout(_queryIpAddress, QUERY_IP_TIMER * 1000);
      } else {
        deferred.resolve(addrs);
      }
    });
  }

  _queryIpAddress();
  return deferred.promise;
}

/**
 * Wait for a Digital Ocean action to complete
 */
var EVENT_POLL_TIMER = 1;
function waitForAction(client, dropletId, actionId) {
  'use strict';
  var deferred = Q.defer();
  function _getAction() {
    client.dropletsGetAction(dropletId, actionId, function (err, res, body) {
      var status = body.action.status;
      if (status === "completed") {
        return deferred.resolve();
      } else if (status === "errored") {
        return deferred.reject();
      } else {
        setTimeout(_getAction, EVENT_POLL_TIMER * 1000);
      }
    });
  }
  _getAction();
  return deferred.promise;
}

/**
 * Turn on a droplet if it is not active.
 */
function startServer(client, dropletId) {
  'use strict';
  var deferred = Q.defer();
  client.dropletsRequestAction(dropletId, {"type": "power_on"}, function (err, res, body) {
    if (err) {
      deferred.reject(err);
    } else {
      waitForAction(client, dropletId, body.action.id).then(function() {
        return deferred.resolve();
      });
    }
  });
  return deferred.promise;
}

function addKey(client, keyName, sshKey) {
  'use strict';
  var deferred = Q.defer();
  // Attempt to add a key
  client.accountAddKey({name: keyName, public_key: sshKey},
      function (err, res, body) {
    if (err) {
      return deferred.reject(err);
    } else if (body.message === 'SSH Key is already in use on your account') {
      // Account already has this key added, need to find it's ID.
      client.accountGetKeys({}, function(err, res, body) {
        if (err) {
          return deferred.reject(err);
        }
        for (var i = 0; i < body.ssh_keys.length; ++i) {
          if (body.ssh_keys[i].public_key === sshKey) {
            return deferred.resolve(body.ssh_keys[i].id);
          }
        }
        return deferred.reject('Error finding key id');
      });
    } else {
      // Successfully added a new key, return it's ID.
      return deferred.resolve(body.ssh_key.id);
    }
  });
  return deferred.promise;
}

/*
 * Gets an SSH public/private key pair from localstorage or generate a new one
 */
function getKeyPair() {
  "use strict";
  var rsa = forge.pki.rsa;
  var pair = rsa.generateKeyPair({bits: 1024, e: 0x10001});  // TODO: use async
  var publicKey = forge.ssh.publicKeyToOpenSSH(pair.publicKey, 'info@uproxy.org');
  var privateKey = forge.ssh.privateKeyToOpenSSH(pair.privateKey, '');
  return {public: publicKey, private: privateKey};
}

// TODO: we should change the name of this file from provision to something like
// digital-ocean-server.js
var DigitalOceanServer = function() {
  "use strict";
  this.eventListeners = {
    'statusUpdate': []
  };
};

/**
 * Given an accessToken and name,
 * make sure there is a droplet with requested name that exists and is powered on.
 * returns the endpoint host & port for connections.
 */
DigitalOceanServer.prototype.start = function(accessToken, name) {
  'use strict';

  var client = new DigitalOcean(accessToken, 25),
    deferred = Q.defer();

  var emit = this.emit.bind(this);

  client.dropletsGetAll({}, function (err, res, body) {
    emit('statusUpdate', 'Loaded droplets');

    // TODO: What if we don't have the keys here?
    // Check if there is an existing droplet with name, and start it
    var droplets = body.droplets;
    if (err) {
      return deferred.reject(err);
    }

    function queryIPAndResolve(dropletId) {
      queryIpAddress(client, dropletId).then(function (ips) {
        emit('statusUpdate', 'Got IP address: ' + ips[0]);
        deferred.resolve(ips);
      }); 
    }

    for (var i = 0; i < droplets.length; i += 1) {
      if (droplets[i].name === name) {
        if (droplets[i].status === "active" || droplets[i].status === "in-progress") {
          return deferred.resolve(queryIpAddress(client, droplets[i].id));
        } else {
          return startServer(client, droplets[i].id).
              then(queryIPAndResolve.bind({}, droplets[i].id));
        }
      }
    }

    // Generate an SSH key pair
    emit('statusUpdate', 'Creating key');
    var pair = getKeyPair();
    var sshKey = pair.public;
    window.localStorage.setItem("DigitalOcean-" + name + "-PublicKey", pair.public);
    window.localStorage.setItem("DigitalOcean-" + name + "-PrivateKey", pair.private);  // TODO: Is this safe?

    // Create a droplet with this SSH key as an authorized key
    emit('statusUpdate', 'Adding key');
    addKey(client, name + ' Key', sshKey).then(function(sshKeyId) {
      var config = {
        name: name,
        region: "nyc3",
        size: "512mb",
        image: "ubuntu-14-04-x64",
        ssh_keys: [sshKeyId]
      };
      emit('statusUpdate', 'Creating droplet');
      client.dropletsCreate(config, function (err, res, body) {
        var droplet = body.droplet;
        emit('statusUpdate', 'Waiting for droplet to create');
        waitForAction(client, droplet.id, body.links.actions[0].id).then(function() {
          emit('statusUpdate', 'Getting IP address');
          queryIpAddress(client, droplet.id).then(function (ips) {
            emit('statusUpdate', 'Got IP address: ' + ips[0]);
            deferred.resolve(ips);
          });
        });
      });
    });
  });

  return deferred.promise;
};

DigitalOceanServer.prototype.on = function(eventName, callback) {
  "use strict";
  if (this.eventListeners[eventName] === undefined) {
    throw Error('unknown event ' + eventName);
  }
  this.eventListeners[eventName].push(callback);
};

DigitalOceanServer.prototype.emit = function(eventName, data) {
  "use strict";
  var callbacks = this.eventListeners[eventName];
  for (var i = 0; i < callbacks.length; ++i) {
    callbacks[i](data);
  }
};

var Provisioner = function(dispatchEvent) {
  this.dispatch = dispatchEvent;
};

Provisioner.prototype._sendStatus = function(code) {
  this.dispatch("status", {
    "code": code,
    "message": STATUS_CODES[code]
  });
};

Provisioner.prototype.start = function() {
  this._sendStatus("START");
  return new Promise(function(resolve, reject) {
    var oauth = freedom["core.oauth"]();

    this._sendStatus("OAUTH_INIT");
    oauth.initiateOAuth(REDIRECT_URIS).then(function(obj) {
      var url = "https://cloud.digitalocean.com/v1/oauth/authorize?" +
                "client_id=c16837b5448cd6cf2582d2c2f767cfb7d11844ec395a91b43f26ca72513416c8&" +
                "response_type=token&" +
                "redirect_uri=" + encodeURIComponent(obj.redirect) + "&" +
                "state=" + encodeURIComponent(obj.state) + "&" +
                "scope=read%20write";
      console.log(url);
      return oauth.launchAuthFlow(url, obj);
    }).then(function(redirectUrl) {
      console.log("Ignoring code: " + redirectUrl);
      // app.onOAuthToken(redirectUrl);
    }).catch(function(err) {
      console.log("launchAuthFlow error: " + err);
    });
    resolve({});
  }.bind(this));
}

freedom().providePromises(Provisioner)
