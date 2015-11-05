//var XMLHttpRequest = require('freedom-xhr').corexhr;
// Included directly in freedom module. node-forge not browserify-friendly
//var forge = require('node-forge')({ disableNativeCode: true });

var POLL_TIMEOUT = 1000; //milliseconds

var STATUS_CODES = {
  "START": "Starting provisioner",
  "OAUTH_INIT": "Initializing oauth flow",
  "OAUTH_ERROR": "Error getting oauth token",
  "OAUTH_COMPLETE": "Got oauth token",
  "SSHKEY_RETRIEVED": "Retrieved SSH keys from storage",
  "SSHKEY_GENERATED": "Generated new SSH keys",
  "CLOUD_FAILED": "Failed to complete cloud operation",
  "CLOUD_INIT_ADDKEY": "Starting to add SSH key to cloud account",
  "CLOUD_DONE_ADDKEY": "Done adding SSH key to cloud account",
  "CLOUD_INIT_GETVM": "Starting to get all VMs",
  "CLOUD_DONE_GETVM": "Done getting all VMs",

};

var REDIRECT_URIS = [
  "https://kmnjcbmibpajfljogomikcdlmhgpnolg.chromiumapp.org"
  //  "http://localhost:10101"
];

var Provisioner = function(dispatchEvent) {
  this.dispatch = dispatchEvent;
  this.state = {};
};

/**
 * Dispatches status events
 * events listed in STATUS_CODES
 **/
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

/**
 * Initiates a Digital Ocean oAuth flow
 **/
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
      this._sendStatus("OAUTH_ERROR");
      reject(err)
    }.bind(this));
  }.bind(this));
};

/**
 * Try to retrieve SSH keys from storage.
 * If not found, generate new ones and store
 **/
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
      reject(err);
    });
  }.bind(this));
};

/**
 * Make a request to Digital Ocean
 **/
Provisioner.prototype._doRequest = function(method, actionPath, body) {
  return new Promise(function(resolve, reject) {
    var url = 'https://api.digitalocean.com/v2/' + actionPath;
    var xhr = freedom["core.xhr"]()
    xhr.on("onload", function(resolve, reject, xhr, e) {
      xhr.getResponseText().then(function(resolve, reject, resp){
        try {
          var json = JSON.parse(resp);
          resolve(json);
        } catch(e) {
          reject(e);
        }
      }.bind(this, resolve, reject));
    }.bind(this, resolve, reject, xhr));
    xhr.on("onerror", reject);
    xhr.on("ontimeout", reject);
    xhr.open(method, url, true);
    xhr.setRequestHeader("Authorization", "Bearer " + this.state.oauth.access_token);
    xhr.setRequestHeader("Content-Type", "application/json");
    if (body !== null && typeof body !== "undefined") {
      xhr.send({ string: body })
    } else {
      xhr.send(null);
    }
  }.bind(this));
};

Provisioner.prototype._waitDigitalOceanActions = function(resolve, reject) {
  console.log("Polling for Digital Ocean in-progress actions");
  this._doRequest("GET", "droplets/" + this.state.cloud.vm.id + "/actions").then(function(resp) {
    for (var i = 0; i < resp.actions.length; i++) {
      if (resp.actions[i].status === "in-progress") {
        setTimeout(this._waitDigitalOceanActions.bind(this, resolve, reject), POLL_TIMEOUT);
      }
    }
    resolve(resp);
  }.bind(this)).catch(function(e) {
    console.error("Error waiting for digital ocean actions:" + JSON.stringify(e));
    reject(e)
  }.bind(this));
  
};

Provisioner.prototype._setupDigitalOcean = function(name) {
  return new Promise(function(resolve, reject) {
    this.state.cloud = {};


    this._doRequest("GET", "account/keys").then(function(resp) {
      console.log(resp);
      for (var i = 0; i < resp.ssh_keys.length; i++) {
        if (resp.ssh_keys[i].public_key === this.state.ssh.public) {
          return Promise.resolve({
            message: "SSH Key is already in use on your account",
            ssh_key: resp.ssh_keys[i]
          });
        } 
      }
      return this._doRequest("POST", "account/keys", JSON.stringify({
        name: name,
        public_key: this.state.ssh.public
      }));
    }.bind(this)).then(function(resp) {
      console.log(resp);
      this.state.cloud.ssh = resp.ssh_key;
      return this._doRequest("GET", "droplets");
    }.bind(this)).then(function(resp) {
      console.log(resp);
      for (var i = 0; i < resp.droplets.length; i++) {
        if (resp.droplets[i].name === name) {
          return Promise.resolve({
            message: "Droplet already created with name=" + name,
            droplet: resp.droplets[i]
          });
        }
      }

      return this._doRequest("POST", "droplets", JSON.stringify({
        name: name,
        region: "nyc3",
        size: "512mb",
        image: "ubuntu-14-04-x64",
        ssh_keys: [ this.state.cloud.ssh.id ]
      }));
    }.bind(this)).then(function(resp) {
      console.log(resp);
      this.state.cloud.vm = resp.droplet;
     
      if (resp.droplet.status == "power_off") {
        // Need to power on VM
        return this._doRequest(
          "POST", 
          "droplets/" + resp.droplet.id + "/actions",
          JSON.stringify({ "type": "power_on" })
        ) 
      } else {
        return Promise.resolve();
      }
    }.bind(this)).then(function(resp) {
      console.log(resp);
      this._waitDigitalOceanActions(resolve, reject);
    }.bind(this)).catch(function(err) {
      console.error("Error w/DigitalOcean: " + err);
      this._sendStatus("CLOUD_FAILED");
      reject({
        errcode: "",
        message: JSON.stringify(err)
      });
    }.bind(this));
  }.bind(this));
}

/**
 * One-click setup of a VM
 * See freedom-module.json for return and error types
 **/
Provisioner.prototype.start = function(name) {
  this._sendStatus("START");
  // Do oAuth
  return this._doOAuth().then(function(oauthObj) {
    this.state.oauth = oauthObj;
    return this._getSshKey(name);
  // Get SSH keys
  }.bind(this)).then(function(keys) {
    this.state.ssh = keys;
    return this._setupDigitalOcean(name);
  // Setup Digital Ocean (SSH key + droplet)
  }.bind(this)).then(function(actions) {
    console.log(actions);
    return this._doRequest("GET", "droplets/"+this.state.cloud.vm.id);
  // Get the droplet's configuration
  }.bind(this)).then(function(resp) {
    this.state.cloud.vm = resp.droplet;
    this.state.network = {
      "ssh_port": 22
    }
    // Retrieve public IPv4 address
    for (var i = 0; i < resp.droplet.networks.v4.length; i++) {
      if (resp.droplet.networks.v4[i].type === "public") {
        this.state.network.ipv4 = resp.droplet.networks.v4[i].ip_address;
      }
    }
    // Retrieve public IPv6 address
    for (var i = 0; i < resp.droplet.networks.v6.length; i++) {
      if (resp.droplet.networks.v6[i].type === "public") {
        this.state.network.ipv6 = resp.droplet.networks.v6[i].ip_address;
      }
    }
    console.log(this.state);
    return this.state;
  }.bind(this));
}

freedom().providePromises(Provisioner);
