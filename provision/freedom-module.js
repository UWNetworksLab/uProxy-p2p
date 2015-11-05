//var XMLHttpRequest = require('freedom-xhr').corexhr;
// Included directly in freedom module. node-forge not browserify-friendly
//var forge = require('node-forge')({ disableNativeCode: true });

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
      reject(err);
    });
  }.bind(this));
};

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

Provisioner.prototype._setupDigitalOcean = function(name) {
  return new Promise(function(resolve, reject) {

    /**
    this._sendStatus("CLOUD_INIT_GETVM");
    this._doRequest("GET", "droplets").then(function(response) {
      this._sendStatus("CLOUD_DONE_GETVM");
      console.log(response);

      resolve(response);
    }.bind(this))**/
   /**
    .then(function(response) {
      console.log(response);
    }.bind(this))
    **/
    this._doRequest("GET", "account/keys").then(function(cloudSshKeys) {
      console.log(cloudSshKeys);
      for (var i = 0; i < cloudSshKeys.ssh_keys.length; i++) {
        if (cloudSshKeys.ssh_keys[i].public_key === this.state.ssh.public) {
          return Promise.resolve({
            message: "SSH Key is already in use on your account",
            ssh_key: cloudSshKeys.ssh_keys[i]
          });
        } 
      }
      return this._doRequest("POST", "account/keys", JSON.stringify({
        name: name,
        public_key: this.state.ssh.public
      }));
    }.bind(this)).then(function(sshKey) {
      console.log(sshKey);
      resolve();
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

Provisioner.prototype.start = function(name) {
  this._sendStatus("START");
  return this._doOAuth().then(function(oauthObj) {
    this.state.oauth = oauthObj;
    return this._getSshKey(name);
  }.bind(this)).then(function(keys) {
    this.state.ssh = keys;
    return this._setupDigitalOcean(name);
  }.bind(this)).then(function() {
    console.log(this.state);
    return this.state;
  }.bind(this));
}

freedom().providePromises(Provisioner);
