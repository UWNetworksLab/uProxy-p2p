/// <reference path='../../../../../third_party/typings/browser.d.ts' />

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
  'CLOUD_ERR': 'Error from cloud provider'
};

const REDIRECT_URIS: [string] = [
  'https://fmdppkkepalnkeommjadgbhiohihdhii.chromiumapp.org',
  //  'http://localhost:10101'
];

interface KeyPair {
  private: string;
  public: string;
}

class Provisioner {
  constructor(private dispatch_: Function, private state_: any = {}) {}

  /**
   * One-click setup of a VM
   * See freedom-module.json for return and error types
   * @param {String} name of VM to create
   * @param {String} region to create VM in
   * @return {Promise.<Object>}
   */
  public start = (name: string, region = DEFAULT_REGION, image = DEFAULT_IMAGE, size = DEFAULT_SIZE): Promise<Object> => {
    log.debug('start %1', name);

    return this.doOAuth_().then((oauthObj: any) => {
      this.state_.oauth = oauthObj;
      return this.getSshKey_(name);
    }).then((keys: KeyPair) => {
      this.state_.ssh = keys;

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
      this.state_.cloud.vm = droplet;
      this.state_.network = {
        'ssh_port': 22
      };
      // Retrieve public IPv4 address
      for (var i = 0; i < droplet.networks.v4.length; i++) {
        if (droplet.networks.v4[i].type === 'public') {
          this.state_.network['ipv4'] = droplet.networks.v4[i].ip_address;
          break;
        }
      }
      // Retrieve public IPv6 address
      for (var i = 0; i < droplet.networks.v6.length; i++) {
        if (droplet.networks.v6[i].type === 'public') {
          this.state_.network['ipv6'] = droplet.networks.v6[i].ip_address;
          break;
        }
      }

      // It usually takes several seconds after the API reports success for
      // SSH on a new droplet to become responsive.
      log.debug('waiting for SSH port to become active');
      return new Pinger(this.state_.network['ipv4'], 22, 60).ping().then(() => {
        return this.state_;
      });
    });
  }

  /**
   * One-click destruction of a VM
   * @param {String} name of VM to create
   * @return {Promise.<void>}
   */
  public stop = (name: string): Promise<void> => {
    log.debug('stop %1', name);
    return this.doOAuth_().then((oauthObj: any) => {
      this.state_.oauth = oauthObj;
    }).then(() => {
      return this.destroyServer_(name);
    });
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
      this.state_.cloud = this.state_.cloud || {};
      this.state_.cloud.vm = this.state_.cloud.vm || droplet;
      // Make sure there are no actions in progress before deleting
      return this.waitDigitalOceanActions_();
    }).then(() => {
      return this.doRequest_('DELETE', 'droplets/' + this.state_.cloud.vm.id);
    }).then((resp: any) => {
      if (resp.status.startsWith('204')) {
        // Wait until server is deleted
        return this.waitDigitalOceanActions_();
      } else {
        return Promise.reject(new Error('error deleting droplet'));
      }
    }).catch((e: any) => {
      if (e.errcode === 'VM_DNE') {
        // Don't return an error if droplet doesn't exist
        return Promise.resolve<void>();
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
    log.debug('reboot %1', name);
    return this.doOAuth_().then((oauthObj: any) => {
      this.state_.oauth = oauthObj;
    }).then(() => {
      return this.getDropletByName_(name);
    }).then((droplet: any) => {
      this.state_.cloud = this.state_.cloud || {};
      this.state_.cloud.vm = this.state_.cloud.vm || droplet;
      // Make sure there are no actions in progress before rebooting
      return this.waitDigitalOceanActions_();
    }).then(() => {
      return this.doRequest_('POST', 'droplets/' + this.state_.cloud.vm.id + '/actions', JSON.stringify({
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
   * Initiates a Digital Ocean oAuth flow
   * @return {Promise.<Object>} oAuth response from Digital Ocean
   *  {
   *    access_token: '..',
   *    expires_in: '..',
   *    state: '..',
   *    token_type: '..'
   *  }
   */
  private doOAuth_ = () : Promise<Object> => {
    log.debug('doOAuth_');
    return new Promise((F, R) => {
      var oauth = freedom['core.oauth']();
      oauth.initiateOAuth(REDIRECT_URIS).then((obj: any) => {
        var url = 'https://cloud.digitalocean.com/v1/oauth/authorize?' +
            'client_id=41f77ea7aa94311a2337027eb238591db9e98c6e2c1067b3b2c7c3420901703f&' +
            'response_type=token&' +
            'redirect_uri=' + encodeURIComponent(obj.redirect) + '&' +
            'state=' + encodeURIComponent(obj.state) + '&' +
            'scope=read%20write';
        return oauth.launchAuthFlow(url, obj);
      }).then((responseUrl: string) => {
        var query = responseUrl.substr(responseUrl.indexOf('#') + 1),
            param: string,
            params: { [k: string]: string } = {},
            keys = query.split('&'),
            i = 0;
        for (i = 0; i < keys.length; i++) {
          param = keys[i].substr(0, keys[i].indexOf('='));
          params[param] = keys[i].substr(keys[i].indexOf('=') + 1);
        }
        F(params);
      }).catch((err: Error) => {
        R(err);
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
    log.debug('getSshKey_ %1', name);
    const publicKeyIndex = 'DigitalOcean-' + name + '-PublicKey';
    const privateKeyIndex = 'DigitalOcean-' + name + '-PrivateKey';
    const storage = freedom['core.storage']();
    return Promise.all([
        storage.get(publicKeyIndex),
        storage.get(privateKeyIndex)
    ]).then((results: string[]) => {
      if (results[0] !== null && results[1] !== null) {
        log.debug('found SSH keys for %1 in storage', name);
        return {
          public: results[0],
          private: results[1]
        };
      }

      try {
        log.debug('generating SSH keys for %1', name);
        const result = Provisioner.generateKeyPair_();
        return Promise.all([
          storage.set(publicKeyIndex, result.public),
          storage.set(privateKeyIndex, result.private)
        ]).then((ignored: any) => {
          return result;
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
   * Make a request to Digital Ocean
   * @param {String} method - GET/POST/DELETE etc
   * @param {String} actionPath - e.g. 'droplets/'
   * @param {String} body - if POST, contents to post
   * @return {Promise.<Object>} - JSON object of response body
   */
  private doRequest_ = (method: string, actionPath: string, body?: string) :
      Promise<Object> => {
    return new Promise((F, R) => {
      var url = 'https://api.digitalocean.com/v2/' + actionPath;
      var xhr = freedom['core.xhr']();
      xhr.on('onload', (loadInfo: any) => {
        // DELETE method doesn't return a reponse body. Success
        // is indicated by 204 response code in header.
        if (method === 'DELETE') {
          xhr.getResponseHeader('status').then((response: string) => {
            F({'status': response});
          });
        } else {
          xhr.getResponseText().then((response: string) => {
            try {
              F(JSON.parse(response));
            } catch (e) {
              R(e);
            }
          });
        }
      });
      xhr.on('onerror', R);
      xhr.on('ontimeout', R);
      xhr.open(method, url, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + this.state_.oauth.access_token);
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (body !== null && typeof body !== 'undefined') {
        xhr.send({ string: body });
      } else {
        xhr.send(null);
      }
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
    return this.doRequest_('GET', 'droplets/' + this.state_.cloud.vm.id + '/actions').then((resp: any) => {
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
   * Assumes we already have oAuth token and  SSH key in this.state_
   * This method will use this.waitDigitalOceanActions_() to wait until all actions complete
   * before resolving
   * @param {String} name of droplet
   * @param {String} region to create VM in
   * @return {Promise.<void>} resolves on success, rejects on failure
   */
  private setupDigitalOcean_ = (name: string, region: string, image: string, size: string):  Promise<void> => {
    log.info('creating %1 droplet in %2', image, region);
    return new Promise<void>((F, R) => {
      this.state_.cloud = {};
      // Get SSH keys in account
      this.doRequest_('GET', 'account/keys').then((resp: any) => {
        for (var i = 0; i < resp.ssh_keys.length; i++) {
          if (resp.ssh_keys[i].public_key === this.state_.ssh.public) {
            return Promise.resolve({
              message: 'SSH Key is already in use on your account',
              ssh_key: resp.ssh_keys[i]
            });
          } 
        }
        return this.doRequest_('POST', 'account/keys', JSON.stringify({
          name: name,
          public_key: this.state_.ssh.public
        }));
        // If missing, put SSH key into account
      }).then((resp: any) => {
        this.state_.cloud.ssh = resp.ssh_key;
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
          ssh_keys: [ this.state_.cloud.ssh.id ]
        }));
        // If missing, create the droplet
      }).then((resp: any) => {
        this.state_.cloud.vm = resp.droplet;
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
