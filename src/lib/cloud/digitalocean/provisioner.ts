/// <reference path='../../../../third_party/typings/index.d.ts' />

import logging = require('../../logging/logging');
import Pinger = require('../../net/pinger');

declare const freedom: freedom.FreedomInModuleEnv;

// TODO: https://github.com/uProxy/uproxy/issues/2051
declare var forge: any;

const log = new logging.Log('digitalocean');

const POLL_TIMEOUT: number = 5000; //milliseconds

// This is the image and size recommended by the blog post.
// The only way to see the complete current list of options for each
// is by querying the API, e.g.:
//   this.doRequest_('GET', 'images?per_page=100').then((resp: any) => {
//     console.log('available images: ' + JSON.stringify(resp, undefined, 2));
//   });
const DEFAULT_REGION: string = 'nyc1';
const DEFAULT_IMAGE: string = 'docker';
const DEFAULT_SIZE: string = '1gb';

const ERR_CODES: { [k: string]: string; } = {
  'VM_AE': 'VM already exists.',
  'VM_DNE': 'VM does not exist',
  'OAUTH_ERR': 'Error handling OAuth',
  'CLOUD_ERR': 'Error from cloud provider'
};

const REDIRECT_URIS: [string] = [
  'https://fmdppkkepalnkeommjadgbhiohihdhii.chromiumapp.org',
  //  'http://localhost:10101'
];

const STORAGE_KEY_OAUTH = 'DigitalOcean-OAuth';

let storageKeyForSSHKey = (name :string, pub :boolean) :string =>
  'DigitalOcean-' + name + (pub && '-PublicKey' || '-PrivateKey');

interface KeyPair {
  private: string;
  public: string;
}

class Provisioner {
  constructor(
    // This argument is passed implicitly to all freedomjs module constructors:
    private dispatch_ :Function,

    private sshKeyPair_ :any,
    private network_ :any,
    private storage_ :freedom.Storage.Storage,

    // TODO: give this concept a better name, or use a different abstraction?
    private cloud_ :any,

    // doOAuth_() may be called multiple times concurrently before an OAuth
    // flow has been completed. In order to ensure that each call doesn't
    // trigger an additional OAuth flow in a new tab, the promise returned by
    // the first call is cached in this field, and this cached promise is
    // returned for subsequent calls. The cached promise is invalidated if
    // getOAuthFromStorage_() is called and it rejects (e.g. due to the saved
    // OAuth token having expired).
    private promiseOAuth_ :Promise<Object>) {
      this.storage_ = freedom['core.storage']();
    }

  /*
   * Returns whether a DO OAuth token is saved in storage.
   */
  public hasOAuth = () : Promise<boolean> => {
    return this.getOAuthFromStorage_().then(
      (result) => { return !!result; },
      () => { return false; }
    );
  }

  /*
   * TODO: Automatically exchange expired oauth tokens for fresh ones?
   * Looks like this is supported:
   * https://developers.digitalocean.com/documentation/oauth/#refresh-token-flow
   * ref: https://github.com/uProxy/uproxy/issues/2565
   */
  private getOAuthFromStorage_ = () :Promise<any> => {
    return new Promise((F, R) => {
      let reject = (errcode :string, message :string, data? :any, exc? :any) => {
        let err = {errcode: errcode, message: message, data: data, exc: exc};
        log.debug(message, data);
        this.storage_.remove(STORAGE_KEY_OAUTH).then(() => {
          this.promiseOAuth_ = null;  // Invalidate any cached promise
          R(err);
        });
      }
      log.debug('Looking for oauthJson in storage...');
      this.storage_.get(STORAGE_KEY_OAUTH).then((oauthJson :string) => {
        if (!oauthJson) {
          return reject('OAUTH_ERR', 'Missing oauthJson', oauthJson);
        }
        let oauthObj :any;
        try {
          oauthObj = JSON.parse(oauthJson);
        } catch (e) {
          return reject('OAUTH_ERR', 'Error parsing oauthJson', oauthJson, e);
        }
        log.debug('Retrieved saved OAuth from storage:', oauthObj);
        if (!oauthObj.access_token) {
          return reject('OAUTH_ERR', 'Missing access_token field', oauthObj);
        }
        if (oauthObj.expires_at) {
          const now = Date.now() / 1000 | 0;  // Seconds since epoch.
          const validFor = oauthObj.expires_at - now;  // Valid seconds left.
          if (validFor <= 0) {
            return reject('OAUTH_ERR', 'Stored OAuth expired', validFor);
          } else {
            log.debug('Stored OAuth valid for another ' + validFor + 's');
          }
        } else {
          log.debug('Missing expired_at field. Assuming unexpired.');
        }
        log.debug('Resolving: oauthObj:', oauthObj);
        F(oauthObj);
      });
    });
  }

  /**
   * One-click setup of a VM
   * See freedom-module.json for return and error types
   * @param {String} name of VM to create
   * @param {String} region to create VM in
   * @return {Promise.<Object>}
   */
  public start = (name: string, region = DEFAULT_REGION, image = DEFAULT_IMAGE, size = DEFAULT_SIZE): Promise<Object> => {
    log.debug('start', name);

    return this.getSshKey_(name).then((keypair: KeyPair) => {
      this.sshKeyPair_ = keypair;

      return this.getDropletByName_(name).then((unused :any) => {
        return Promise.reject({
          'errcode': 'VM_AE',
          'message': 'Droplet ' + name + ' already exists'
        });
      }, (e: Error) => {
        // Droplet does not exist so continue creating new server
        // Setup Digital Ocean (SSH key + droplet)
        return this.setupDigitalOcean_(name, region, image, size);
      });
    }).then(() => {
      // Get the droplet's configuration
      return this.getDropletByName_(name);
    }).then((droplet:any) => {
      this.cloud_.vm = droplet;
      this.network_ = {
        'ssh_port': 22
      };
      // Retrieve public IPv4 address
      for (var i = 0; i < droplet.networks.v4.length; i++) {
        if (droplet.networks.v4[i].type === 'public') {
          this.network_['ipv4'] = droplet.networks.v4[i].ip_address;
          break;
        }
      }
      // Retrieve public IPv6 address
      for (var i = 0; i < droplet.networks.v6.length; i++) {
        if (droplet.networks.v6[i].type === 'public') {
          this.network_['ipv6'] = droplet.networks.v6[i].ip_address;
          break;
        }
      }

      // It usually takes several seconds after the API reports success for
      // SSH on a new droplet to become responsive.
      log.debug('waiting for SSH port to become active');
      return new Pinger(this.network_['ipv4'], 22, 60).ping().then(() => {
        // Keep in sync with the return type declaration in freedom-module.json:
        return {ssh: this.sshKeyPair_, network: this.network_};
      });
    });
  }

  /**
   * One-click destruction of a VM
   * @param {String} name of VM to create
   * @return {Promise.<void>}
   */
  public stop = (name: string): Promise<void> => {
    log.debug('stop', name);
    return this.destroyServer_(name);
  }

  /**
   * Destroys cloud server; assumes OAuth has already been completed
   * This method will use this.waitDigitalOceanActions_() to wait until the server is deleted
   * @param {String} droplet name, as a string
   * @return {Promise.<void>}
   */
  private destroyServer_ = (name: string): Promise<void> => {
    return this.doRequest_('GET', 'droplets').then((resp: any) => {
      // Find and delete the server with the same name
      return this.getDropletByName_(name);
    }).then((droplet: any) => {
      this.cloud_ = this.cloud_ || {};
      this.cloud_.vm = this.cloud_.vm || droplet;
      // Make sure there are no actions in progress before deleting
      return this.waitDigitalOceanActions_();
    }).then(() => {
      return this.doRequest_('DELETE', 'droplets/' + this.cloud_.vm.id);
    }).then((resp: any) => {
      if (resp.statusCode === 204) {
        // Wait until server is deleted
        return this.waitDigitalOceanActions_();
      } else {
        return Promise.reject(new Error('error deleting droplet'));
      }
    }).catch((e: any) => {
      if (e.errcode === 'VM_DNE') {
        // Don't return an error if droplet doesn't exist
        return Promise.resolve();
      }
      return Promise.reject(e);
    });
  }

  /**
   * Reboots a droplet with this name
   * @param {String} droplet name, as a string
   * @return {Promise.<void>}, resolves after waiting for reboot action
   * to complete or rejects if droplet doesn't exist
   */
  public reboot = (name: string) : Promise<void> => {
    log.debug('reboot', name);
    return this.getDropletByName_(name).then((droplet: any) => {
      this.cloud_ = this.cloud_ || {};
      this.cloud_.vm = this.cloud_.vm || droplet;
      // Make sure there are no actions in progress before rebooting
      return this.waitDigitalOceanActions_();
    }).then(() => {
      return this.doRequest_('POST', 'droplets/' + this.cloud_.vm.id + '/actions', JSON.stringify({
        type: 'reboot',
      }));
    }).then((unused: any) => {
      // Wait until reboot server is completed
      return this.waitDigitalOceanActions_();
    });
  }

  // Resolves with the (de-serialised) droplet, rejecting if not found.
  private getDropletByName_ = (name: string) : Promise<Object> => {
    return this.doRequest_('GET', 'droplets').then((resp: any) => {
      for (let i = 0; i < resp.droplets.length; i++) {
        if (resp.droplets[i].name === name) {
          return Promise.resolve(resp.droplets[i]);
        }
      }
      return Promise.reject({
        'errcode': 'VM_DNE',
        'message': 'Droplet ' + name + ' doesnt exist'
      });
    });
  }

  /**
   * Generates an RSA keypair using forge
   * @return {KeyPair} public and private SSH keys
   */
  private static generateKeyPair_ = () : KeyPair => {
    const pair = forge.pki.rsa.generateKeyPair({
      bits: 2048
    });
    // trim() the string because forge adds a trailing space to
    // public keys which really messes things up later.
    const publicKey = forge.ssh.publicKeyToOpenSSH(pair.publicKey, '').trim();
    const privateKey = forge.ssh.privateKeyToOpenSSH(pair.privateKey, '').trim();
    return {
      public: publicKey,
      private: privateKey
    };
  }

  /**
   * Initiates a Digital Ocean OAuth flow.
   * OAuth response saved in storage upon receipt for future use.
   * The promise returned is cached so that multiple concurrent calls all
   * wait on the same promise.
   * @return {Promise.<Object>} OAuth data from DigitalOcean:
   * {
   *   access_token :string;
   *   expires_in :number;
   *   expires_at :number;  // <unix timestamp calculated from expires_in>
   *   state :string;
   *   token_type :string;
   * }
   */
  private doOAuth_ = () : Promise<Object> => {
    log.debug('In doOAuth_');
    if (this.promiseOAuth_) {
      log.debug('Returning cached promiseOAuth_', this.promiseOAuth_);
      return this.promiseOAuth_;
    }
    return this.promiseOAuth_ = new Promise((F, R) => {
      var oauth = freedom['core.oauth']();
      log.debug('Initiating OAuth...');
      oauth.initiateOAuth(REDIRECT_URIS).then((obj: any) => {
        var url = 'https://cloud.digitalocean.com/v1/oauth/authorize?' +
            'client_id=41f77ea7aa94311a2337027eb238591db9e98c6e2c1067b3b2c7c3420901703f&' +
            'response_type=token&' +
            'redirect_uri=' + encodeURIComponent(obj.redirect) + '&' +
            'state=' + encodeURIComponent(obj.state) + '&' +
            'scope=read%20write';
        log.debug('Launching OAuth flow...');
        oauth.launchAuthFlow(url, obj).then((responseUrl: string) => {
          log.debug('Got OAuth response:', responseUrl);
          let query = responseUrl.substring(responseUrl.indexOf('#') + 1),
              paramA = query.split('&'),  // param array
              params :any = {};
          for (let i = 0, parami = paramA[i]; parami; parami = paramA[++i]) {
            const idxeq = parami.indexOf('=');
            const param = parami.substring(0, idxeq);
            params[param] = parami.substring(idxeq + 1);
          }
          if (params.expires_in) {
            // params.expires_in gives the number of seconds before the token
            // expires. Use this to calculate the absolute expiration time for
            // later comparison (see getOAuthFromStorage_() above).
            // First calculate the current time (in seconds since the epoch),
            // then add it to the expires_in delta to get the absolute expiration
            // time, and finally subtract some epsilon for wiggle room to be
            // conservative.
            const now = Date.now() / 1000 | 0;  // Unix timestamp in seconds.
            const delta = parseInt(params.expires_in);  // Convert from string.
            if (isNaN(delta)) {
              log.debug('parseInt(expires_in) failed:', params.expires_in);
            } else {
              params.expires_in = delta;
              const epsilon = -60;
              params.expires_at = now + delta + epsilon;
              log.debug('Calculated expires_at:', params.expires_at);
            }
          }
          log.debug('Saving OAuth:', params);
          this.storage_.set(STORAGE_KEY_OAUTH, JSON.stringify(params)).then(() => {
            log.debug('OAuth saved in storage, resolving:', params);
            F(params);
          });
        });
      });
    });
  }

  /**
   * Retrieves an SSH keypair from storage, generating and saving
   * a new keypair if none is found.
   * @param {String} name name of the key
   * @return {Promise.<KeyPair>}
   * @throws if there is any problem loading from or saving to
   * storage or if a keypair cannot be generated
   */
  private getSshKey_ = (name: string) : Promise<KeyPair> => {
    log.debug('getSshKey_', name);
    const storageKeyPub = storageKeyForSSHKey(name, true);
    const storageKeyPri = storageKeyForSSHKey(name, false);
    return Promise.all([
        this.storage_.get(storageKeyPub),
        this.storage_.get(storageKeyPri)
    ]).then((results: string[]) => {
      if (results[0] && results[1]) {
        log.debug('found SSH keys for', name, 'in storage');
        return Promise.resolve({
          public: results[0],
          private: results[1]
        });
      }

      try {
        log.debug('generating SSH keys for', name);
        const result = Provisioner.generateKeyPair_();
        return Promise.all([
          this.storage_.set(storageKeyPub, result.public),
          this.storage_.set(storageKeyPri, result.private)
        ]).then((ignored: any) => {
          return Promise.resolve(result);
        }, (e: Error) => {
          return Promise.reject({
            message: 'error saving SSH keys to storage: ' + e.message
          });
        });
      } catch (e) {
        return Promise.reject({
          message: 'error generating SSH keys: ' + e.message
        });
      }
    }, (e: Error) => {
      return Promise.reject({
        message: 'error loading SSH keys from storage: ' + e.message
      });
    });
  }

  /**
   * Make a request to Digital Ocean.
   * Uses OAuth token saved in storage, if available, otherwise initiates
   * an OAuth flow, awaits authorization (which is then saved in storage),
   * and then tries again.
   * @param {String} method - GET/POST/DELETE etc
   * @param {String} actionPath - e.g. 'droplets/'
   * @param {String} body - if POST, contents to post
   * @return {Promise.<Object>} - JSON object of response body
   */
  private doRequest_ = (method: string, actionPath: string, body?: string, retry = true) :
      Promise<Object> => {
    const url = 'https://api.digitalocean.com/v2/' + actionPath;
    log.debug('Request for:', url);
    return new Promise((F, R) => {
      let maybeRetryAfterOAuth = () => {
        if (!retry) {
          R({errcode: 'CLOUD_ERR', message: 'Request failed', url: url});
          return;
        }
        log.debug('Awaiting OAuth before retrying', url);
        this.doOAuth_().then(() => {
          log.debug('Got OAuth, retrying', url);
          this.doRequest_(method, actionPath, body, false).then((result :any) => {
            log.debug('Request succeeded on retry', url);
            F(result);
          });
        }).catch((e) => {
          log.debug('doOAuth_ failed:', e);
          R(e);
        });
      };
      this.getOAuthFromStorage_().then((oauthObj :any) => {
        const xhr = freedom['core.xhr']();
        log.debug('Making request:', url);
        xhr.on('onload', (loadInfo: any) => {
          xhr.getStatus().then((statusCode :number) => {
            if (statusCode === 401) {
              log.debug('401 response. Invalid access token?');
              // User could have gone to
              // https://cloud.digitalocean.com/settings/api/access
              // to revoke authorization.
              maybeRetryAfterOAuth();
              return;
            }
            // DELETE method doesn't return a reponse body. Success
            // is indicated by 204 response code in header.
            if (method === 'DELETE') {
              F({'statusCode': statusCode});
            } else {
              xhr.getResponseText().then((response: any) => {
                try {
                  response = JSON.parse(response);
                } catch (e) {
                  R({message: 'Could not parse response', error: e, response: response});
                  return;
                }
                F(response);
              });
            }
          });
        });
        xhr.on('onerror', R);
        xhr.on('ontimeout', R);
        xhr.open(method, url, true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + oauthObj.access_token);
        xhr.setRequestHeader('Content-Type', 'application/json');
        if (body !== null && typeof body !== 'undefined') {
          xhr.send({ string: body });
        } else {
          xhr.send(null);
        }
      },
      (e :any) => { maybeRetryAfterOAuth(); });
    });
  }

  /** 
   * Waits for all in-progress Digital Ocean actions to complete
   * e.g. after powering on a machine, or creating a VM
   */
  // TODO: It's not until several moments after this resolves
  //       that you can actually SSH into the server. We need
  //       to find a way to detect when the machine is *really*
  //       ready.
  private waitDigitalOceanActions_ = () : Promise<void> => {
    return this.doRequest_('GET', 'droplets/' + this.cloud_.vm.id + '/actions').then((resp: any) => {
      for (var i = 0; i < resp.actions.length; i++) {
        if (resp.actions[i].status === 'in-progress') {
          log.debug('waiting for operations to complete...');
          return new Promise<void>((F, R) => {
            setTimeout(() => {
              this.waitDigitalOceanActions_().then(F, R);
            }, POLL_TIMEOUT);
          });
        }
        log.debug('all operations complete');
      }
    }).catch((e: Error) => {
      throw e;
    });
  }

  /**
   * Properly configure Digital Ocean with a single droplet of name:name
   * Assumes we already have an OAuth token and SSH keys.
   * This method will use this.waitDigitalOceanActions_() to wait until all actions complete
   * before resolving
   * @param {String} name of droplet
   * @param {String} region to create VM in
   * @return {Promise.<void>} resolves on success, rejects on failure
   */
  private setupDigitalOcean_ = (name: string, region: string, image: string, size: string):  Promise<void> => {
    log.info('creating', image, 'droplet in', region);
    return new Promise<void>((F, R) => {
      this.cloud_ = {};
      // Get SSH keys in account
      this.doRequest_('GET', 'account/keys').then((resp: any) => {
        for (var i = 0; i < resp.ssh_keys.length; i++) {
          if (resp.ssh_keys[i].public_key === this.sshKeyPair_.public) {
            return Promise.resolve({
              message: 'SSH Key is already in use on your account',
              ssh_key: resp.ssh_keys[i]
            });
          }
        }
        return this.doRequest_('POST', 'account/keys', JSON.stringify({
          name: name,
          public_key: this.sshKeyPair_.public
        }));
        // If missing, put SSH key into account
      }).then((resp: any) => {
        this.cloud_.ssh = resp.ssh_key;
        return this.doRequest_('GET', 'droplets');
        // Get list of droplets
      }).then((resp: any) => {
        for (var i = 0; i < resp.droplets.length; i++) {
          if (resp.droplets[i].name === name) {
            return Promise.resolve({
              message: 'Droplet already created with name=' + name,
              droplet: resp.droplets[i]
            });
          }
        }
        return this.doRequest_('POST', 'droplets', JSON.stringify({
          name: name,
          region: region,
          size: size,
          image: image,
          ssh_keys: [ this.cloud_.ssh.id ]
        }));
        // If missing, create the droplet
      }).then((resp: any) => {
        this.cloud_.vm = resp.droplet;
        if (resp.droplet.status == 'off') {
          // Need to power on VM
          return this.doRequest_(
            'POST',
            'droplets/' + resp.droplet.id + '/actions',
            JSON.stringify({ 'type': 'power_on' })
          );
        } else {
          return Promise.resolve();
        }
        // If the machine exists, but powered off, turn it on
      }).then((resp: any) => {
        this.waitDigitalOceanActions_().then(F, R);
        // Wait for all in-progress actions to complete
      }).catch((err: Error) => {
        R({
          errcode: 'CLOUD_ERR',
          message: JSON.stringify(err)
        });
      });
    });
  }
}

export = Provisioner;
