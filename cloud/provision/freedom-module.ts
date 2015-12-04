/// <reference path='../../../../third_party/typings/node/node.d.ts' />
/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../../third_party/typings/freedom/freedom-module-env.d.ts' />

const forge = require("forge-min");

const POLL_TIMEOUT: number = 5000; //milliseconds

const STATUS_CODES: { [k: string]: string; } = {
  "START": "Starting provisioner",
  "OAUTH_INIT": "Initializing oauth flow",
  "OAUTH_ERROR": "Error getting oauth token",
  "OAUTH_COMPLETE": "Got oauth token",
  "SSHKEY_RETRIEVED": "Retrieved SSH keys from storage",
  "SSHKEY_GENERATED": "Generated new SSH keys",
  "CLOUD_FAILED": "Failed to complete cloud operation",
  "CLOUD_INIT_ADDKEY": "Starting to add SSH key to cloud account",
  "CLOUD_DONE_ADDKEY": "Done adding SSH key to cloud account",
  "CLOUD_INIT_VM": "Starting to provision VM",
  "CLOUD_DONE_VM": "Done provisioning VMs",
  "CLOUD_WAITING_VM": "Waiting on VM",
};

const ERR_CODES: { [k: string]: string; } = {
  "VM_DNE": "VM does not exist",
  "CLOUD_ERR": "Error from cloud provider"
};

const REDIRECT_URIS: [string] = [
  "https://pjpcdnccaekokkkeheolmpkfifcbibnj.chromiumapp.org"
  //  "http://localhost:10101"
];

interface KeyPair {
  private: string;
  public: string;
}

class Provisioner {

  constructor(private dispatch_: Function, private state_: any) {}

  /**
   * One-click setup of a VM
   * See freedom-module.json for return and error types
   * @param {String} name of VM to create
   * @return {Promise.<Object>}
   */
  public start = (name: string) : Promise<Object> => {
    this.sendStatus_("START");
    // Do oAuth
    return this.doOAuth_().then((oauthObj: any) => {
      this.state_.oauth = oauthObj;
      return this.getSshKey_(name);
    // Get SSH keys
    }).then((keys: KeyPair) => {
      this.state_.ssh = keys;
      return this.setupDigitalOcean_(name);
    // Setup Digital Ocean (SSH key + droplet)
    }).then((actions: any) => {
      //console.log(actions);
      return this.doRequest_("GET", "droplets/" + this.state_.cloud.vm.id);
    // Get the droplet's configuration
    }).then((resp: any) => {
      this.sendStatus_("CLOUD_DONE_VM");
      this.state_.cloud.vm = resp.droplet;
      this.state_.network.ssh_port = 22;
      // Retrieve public IPv4 address
      for (var i = 0; i < resp.droplet.networks.v4.length; i++) {
        if (resp.droplet.networks.v4[i].type === "public") {
          this.state_.network['ipv4'] = resp.droplet.networks.v4[i].ip_address;
        }
      }
      // Retrieve public IPv6 address
      for (var i = 0; i < resp.droplet.networks.v6.length; i++) {
        if (resp.droplet.networks.v6[i].type === "public") {
          this.state_.network['ipv6'] = resp.droplet.networks.v6[i].ip_address;
        }
      }
      console.log(this.state_);
      return this.state_;
    });
  }

  /**
   * One-click destruction of a VM
   * See freedom-module.json for return and error types
   * @todo currently doesnt wait for destroy to complete before resolving
   * @param {String} name of VM to create
   * @return {Promise.<Object>}
   */
  public stop = (name: string) : Promise<Object> => {
    return this.doRequest_("GET", "droplets").then((resp: any) => {
      for (var i = 0; i < resp.droplets.length; i++) {
        if (resp.droplets[i].name === name) {
          return Promise.resolve({
            droplet: resp.droplets[i]
          });
        }
      }
      return Promise.reject({
        "errcode": "VM_DNE",
        "message": "Droplet with name," + name + ", doesnt exist"
      });
    }).then((resp: any) => {
      return this.doRequest_("DELETE", "droplets/" + resp.droplet.id);
    });
  }

  /**
   * Generates an RSA keypair using forge
   * @return {KeyPair} public and private SSH keys
   */
  private static generateKeyPair_ = () : KeyPair => {
    "use strict";
    var pair = forge.pki.rsa.generateKeyPair({bits: 2048, e: 0x10001});
    var publicKey = forge.ssh.publicKeyToOpenSSH(pair.publicKey, '');
    var privateKey = forge.ssh.privateKeyToOpenSSH(pair.privateKey, '');
    return { public: publicKey, private: privateKey };
  }

  /**
   * Dispatches status events
   * events listed in STATUS_CODES
   * @param {String} code one of STATUS_CODES 
   */
  private sendStatus_ = (code: string): void => {
    this.dispatch_("status", {
      "code": code,
      "message": STATUS_CODES[code]
    });
  }

  /**
   * Initiates a Digital Ocean oAuth flow
   * @return {Promise.<Object>} oAuth response from Digital Ocean
   *  {
   *    access_token: "..",
   *    expires_in: "..",
   *    state: "..",
   *    token_type: ".."
   *  }
   */
  private doOAuth_ = () : Promise<Object> => {
    return new Promise((F, R) => {
      var oauth = freedom["core.oauth"]();
      this.sendStatus_("OAUTH_INIT");
      oauth.initiateOAuth(REDIRECT_URIS).then((obj: any) => {
        var url = "https://cloud.digitalocean.com/v1/oauth/authorize?" +
                  "client_id=c16837b5448cd6cf2582d2c2f767cfb7d11844ec395a91b43f26ca72513416c8&" +
                  "response_type=token&" +
                  "redirect_uri=" + encodeURIComponent(obj.redirect) + "&" +
                  "state=" + encodeURIComponent(obj.state) + "&" +
                  "scope=read%20write";
        return oauth.launchAuthFlow(url, obj);
      }).then((responseUrl: string) => {
        var query = responseUrl.substr(responseUrl.indexOf('#') + 1),
            param: string,
            params: { [k: string]: string },
            keys = query.split('&'),
            i = 0;
        for (i = 0; i < keys.length; i++) {
          param = keys[i].substr(0, keys[i].indexOf('='));
          params[param] = keys[i].substr(keys[i].indexOf('=') + 1);
        }
        this.sendStatus_("OAUTH_COMPLETE");
        F(params);
      }).catch((err: Error) => {
        console.error("oauth error: " + JSON.stringify(err));
        this.sendStatus_("OAUTH_ERROR");
        R(err);
      });
    });
  }

  /**
   * Try to retrieve SSH keys from storage.
   * If not found, generate new ones and store
   * @param {String} name name of the key (usually same as name of VM later)
   * @return {Promise.<KeyPair>} the SSH keys retrieved
   * {
   *    public: "...",
   *    private: "..."
   * }
   */
  private getSshKey_ = (name: string) : Promise<KeyPair> => {
    var storage = freedom["core.storage"]();
    return new Promise((F, R) => {
      var result : KeyPair;
      Promise.all([
        storage.get("DigitalOcean-" + name + "-PublicKey"),
        storage.get("DigitalOcean-" + name + "-PrivateKey")
      ]).then((val: string[]) => {
        if (val[0] === null ||
          val[1] === null) {
          result = Provisioner.generateKeyPair_();
          storage.set("DigitalOcean-" + name + "-PublicKey", result.public);
          storage.set("DigitalOcean-" + name + "-PrivateKey", result.private);
          this.sendStatus_("SSHKEY_GENERATED");
        } else {
          result.public = val[0];
          result.private = val[1];
          this.sendStatus_("SSHKEY_RETRIEVED");
        }
        F(result);
      }).catch((err: Error) => {
        console.error("storage error: " + JSON.stringify(err));
        R(err);
      });
    });
  }
  
  /**
   * Make a request to Digital Ocean
   * @param {String} method - GET/POST/DELETE etc
   * @param {String} actionPath - e.g. "droplets/"
   * @param {String} body - if POST, contents to post
   * @return {Promise.<Object>} - JSON object of response body
   */
  private doRequest_ = (method: string, actionPath: string, body?: string) :
      Promise<Object> => {
    return new Promise((F, R) => {
      var url = 'https://api.digitalocean.com/v2/' + actionPath;
      var xhr = freedom["core.xhr"]();
      xhr.on("onload", (resolve: Function, reject: Function, xhr: any, e: Error) => {
        xhr.getResponseText().then((resolve: Function, reject: Function, resp: string) => {
          try {
            resolve(JSON.parse(resp));
          } catch(e) {
            reject(e);
          }
        });
      });
      xhr.on("onerror", R);
      xhr.on("ontimeout", R);
      xhr.open(method, url, true);
      xhr.setRequestHeader("Authorization", "Bearer " + this.state_.oauth.access_token);
      xhr.setRequestHeader("Content-Type", "application/json");
      if (body !== null && typeof body !== "undefined") {
        xhr.send({ string: body });
      } else {
        xhr.send(null);
      }
    });
  }
  
  /** 
   * Waits for all in-progress Digital Ocean actions to complete
   * e.g. after powering on a machine, or creating a VM
   * @param {Function} resolve - call when done
   * @param {Function} reject - call on failure
   */
  private waitDigitalOceanActions_ = (resolve: Function, reject: Function) : void => {
    console.log("Polling for Digital Ocean in-progress actions");
    this.doRequest_("GET", "droplets/" + this.state_.cloud.vm.id + "/actions").then((resp: any) => {
      for (var i = 0; i < resp.actions.length; i++) {
        if (resp.actions[i].status === "in-progress") {
          setTimeout(this.waitDigitalOceanActions_, POLL_TIMEOUT);
          return;
        }
      }
      resolve(resp);
    }).catch((e: Error) => {
      console.error("Error waiting for digital ocean actions:" + JSON.stringify(e));
      reject(e);
    });
  }
  
  /**
   * Properly configure Digital Ocean with a single droplet of name:name
   * Assumes we already have oAuth token and  SSH key in this.state_
   * This method will use this.waitDigitalOceanActions_() to wait until all actions complete
   * before resolving
   * @param {String} name of droplet
   * @return {Promise.<void>} resolves on success, rejects on failure
   */
  private setupDigitalOcean_ = (name: string) : Promise<void> => {
    return new Promise<void>((F, R) => {
      this.state_.cloud = {};
      this.sendStatus_("CLOUD_INIT_ADDKEY");
      // Get SSH keys in account
      this.doRequest_("GET", "account/keys").then((resp: any) => {
        //console.log(resp);
        for (var i = 0; i < resp.ssh_keys.length; i++) {
          if (resp.ssh_keys[i].public_key === this.state_.ssh.public) {
            return Promise.resolve({
              message: "SSH Key is already in use on your account",
              ssh_key: resp.ssh_keys[i]
            });
          } 
        }
        return this.doRequest_("POST", "account/keys", JSON.stringify({
          name: name,
          public_key: this.state_.ssh.public
        }));
      // If missing, put SSH key into account
      }).then((resp: any) => {
        //console.log(resp);
        this.state_.cloud.ssh = resp.ssh_key;
        this.sendStatus_("CLOUD_DONE_ADDKEY");
        this.sendStatus_("CLOUD_INIT_VM");
        return this.doRequest_("GET", "droplets");
      // Get list of droplets
      }).then((resp: any) => {
        //console.log(resp);
        for (var i = 0; i < resp.droplets.length; i++) {
          if (resp.droplets[i].name === name) {
            return Promise.resolve({
              message: "Droplet already created with name=" + name,
              droplet: resp.droplets[i]
            });
          }
        }
        return this.doRequest_("POST", "droplets", JSON.stringify({
          name: name,
          region: "nyc3",
          size: "512mb",
          image: "ubuntu-14-04-x64",
          ssh_keys: [ this.state_.cloud.ssh.id ]
        }));
      // If missing, create the droplet
      }).then((resp: any) => {
        //console.log(resp);
        this.state_.cloud.vm = resp.droplet;
        if (resp.droplet.status == "off") {
          // Need to power on VM
          return this.doRequest_(
            "POST", 
            "droplets/" + resp.droplet.id + "/actions",
            JSON.stringify({ "type": "power_on" })
          );
        } else {
          return Promise.resolve();
        }
      // If the machine exists, but powered off, turn it on
      }).then((resp: any) => {
        //console.log(resp);
        this.sendStatus_("CLOUD_WAITING_VM");
        this.waitDigitalOceanActions_(F, R);
      // Wait for all in-progress actions to complete
      }).catch((err: Error) => {
        console.error("Error w/DigitalOcean: " + err);
        this.sendStatus_("CLOUD_FAILED");
        R({
          errcode: "CLOUD_ERR",
          message: JSON.stringify(err)
        });
      });
    });
  }
}

if (typeof freedom !== 'undefined') {
  freedom['provisioner']().providePromises(Provisioner);
}

export = Provisioner;
