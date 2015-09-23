import social = require('../interfaces/social');

export var NETWORK_OPTIONS :{[name:string]:social.NetworkOptions} = {
  'Google': {  // Old GTalk XMPP provider, being deprecated.
    isFirebase: false,
    enableMonitoring: true,
    areAllContactsUproxy: false,
    supportsReconnect: true,
    supportsInvites: false
  },
  'Facebook': {  // Old "v1" Facebook Firebase provider, being deprecated.
    isFirebase: true,
    enableMonitoring: true,
    areAllContactsUproxy: true,
    supportsReconnect: true,
    supportsInvites: false
  },
  'Facebook-Firebase-V2': {
    displayName: 'Facebook',
    isFirebase: true,
    enableMonitoring: true,
    areAllContactsUproxy: true,
    supportsReconnect: true,
    supportsInvites: true
  },
  'GMail': {
    isFirebase: true,
    enableMonitoring: true,
    areAllContactsUproxy: true,
    supportsReconnect: true,
    supportsInvites: true
  },
  'WeChat': {
    isFirebase: false,
    enableMonitoring: false,
    areAllContactsUproxy: false,
    supportsReconnect: false,
    supportsInvites: false
  }
};
