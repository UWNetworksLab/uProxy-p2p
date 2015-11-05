var XMLHttpRequest = require('freedom-xhr').corexhr;
var DigitalOcean = require('do-wrapper');
// Included directly in freedom module. node-forge not browserify-friendly
//var forge = require('node-forge')({ disableNativeCode: true });

var STATUS_CODES = {
  "START": "Starting provisioner",
  "OAUTH_INIT": "Initializing oauth flow",
  "OAUTH_ERROR": "Error getting oauth token",
  "OAUTH_COMPLETE": "Got oauth token",
  "SSHKEY_RETRIEVED": "Retrieved SSH keys from storage",
  "SSHKEY_GENERATED": "Generated new SSH keys",

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


var DigitalOceanServer = function() {
  "use strict";
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

var Provisioner = function(dispatchEvent) {
  this.dispatch = dispatchEvent;
};

Provisioner.prototype._sendStatus = function(code) {
  this.dispatch("status", {
    "code": code,
    "message": STATUS_CODES[code]
  });
};

/*
 * Generates an RSA keypair using forge
 */
Provisioner.prototype._generateKeyPair = function() {
  "use strict";
  var pair = forge.pki.rsa.generateKeyPair({bits: 1024, e: 0x10001});  // TODO: use async
  var publicKey = forge.ssh.publicKeyToOpenSSH(pair.publicKey, 'info@uproxy.org');
  var privateKey = forge.ssh.privateKeyToOpenSSH(pair.privateKey, '');
  return { public: publicKey, private: privateKey };
}

Provisioner.prototype._doOAuth = function() {
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
      return oauth.launchAuthFlow(url, obj);
    }).then(function(responseUrl) {
      var query = responseUrl.substr(responseUrl.indexOf('#') + 1),
        param,
        params = {},
        keys = query.split('&'),
        i = 0;

      for (i = 0; i < keys.length; i += 1) {
        param = keys[i].substr(0, keys[i].indexOf('='));
        params[param] = keys[i].substr(keys[i].indexOf('=') + 1);
      }

      this._sendStatus("OAUTH_COMPLETE");
      resolve(params);
    }.bind(this)).catch(function(err) {
      console.error("oauth error: " + JSON.stringify(err));
      reject(err)
    }.bind(this));
  }.bind(this));
};

Provisioner.prototype._getSshKey = function(name) {
  var storage = freedom["core.storage"]();
  return new Promise(function(resolve, reject) {
    var result = {};

    Promise.all([
      storage.get("DigitalOcean-" + name + "-PublicKey"),
      storage.get("DigitalOcean-" + name + "-PrivateKey")
    ]).then(function(val) {
      if (val[0] === null ||
         val[1] === null) {
        result = this._generateKeyPair();
        storage.set("DigitalOcean-" + name + "-PublicKey", result.public);
        storage.set("DigitalOcean-" + name + "-PrivateKey", result.private);
        this._sendStatus("SSHKEY_GENERATED");
      } else {
        result.public = val[0];
        result.private = val[1];
        this._sendStatus("SSHKEY_RETRIEVED");
      }
      resolve(result);
    }.bind(this)).catch(function(err) {
      console.error("storage error: " + JSON.stringify(err));
      reject(err)
    });
  }.bind(this));
};

Provisioner.prototype.start = function(name) {
  var result = {};
  this._sendStatus("START");
  return this._doOAuth().then(function(oauthObj) {
    result.oauth = oauthObj;
    return this._getSshKey(name);
  }.bind(this)).then(function(keys) {
    result.ssh = keys;
    return result;
  }.bind(this));
}

freedom().providePromises(Provisioner)
