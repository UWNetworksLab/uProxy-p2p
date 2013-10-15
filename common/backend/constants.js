// constants
"use strict";

var DEBUG = true; // XXX get this from somewhere else

var Trust = {
  NO: 'no',
  REQUESTED: 'requested',
  OFFERED: 'offered',
  YES: 'yes'
};

var ProxyState = {
  OFF: 'off',
  READY: 'ready',
  RUNNING: 'running'
};

// --------------------------------------------------------------------------
// Initial empty state
// --------------------------------------------------------------------------
// enum of state ids that we need to worry about.
var StateEntries = {
  ME: 'me',
  OPTIONS: 'options',
  INSTANCEIDS: 'instanceIds', // only exists for local storage state.
  INSTANCES: 'instances',   // only exists for in-memory state.
};

// Start off by not trusting anyone.
var DEFAULT_PROXY_STATUS = {
    proxy: ProxyState.OFF,
    client: ProxyState.OFF
};

// Instance object.
var DEFAULT_INSTANCE = {
  instanceId: null,  // Primary key.
  keyHash: null,
  trust: {
    asProxy: Trust.NO,
    asClient: Trust.NO
  },
  status: DEFAULT_PROXY_STATUS,
  description: '',
  notify: false,      // Whether UI should show state-change notification.
  rosterInfo: {       // Info corresponding to its roster entry.
    userId: '',
    name: '',
    network: '',
    url: ''
  }
};

// Contains default for values being loaded from state.
var DEFAULT_LOAD_STATE = {
  // debugging stuff
  '_debug': DEBUG,  // debug state.
  '_msgLog': [],  //

  // A table from network identifier to your status on that network
  // (online/offline/idle, etc)
  'identityStatus': {},

  // me : {
  //   description : string,  // descirption of this installed instance
  //   instanceId : string,   // id for this installed instance
  //   keyHash : string,      // hash of your public key for peer connections
  //   networkDefaults : {    // network connection defaults
  //     [networkNameX]: {    // identifier for the network
  //       autoconnect: boolean  // if true connects at startup
  //     }, ...
  //   },
  //   [userIdX] : {
  //     userId : string,     // same as key [userIdX].
  //     name : string,       // user-friendly name given by network
  //     url : string         // ?
  //     clients: {
  //       [clientIdX]: {
  //         clientId: string, // same as key [clientIdX].
  //         // TODO: users should live in network, not visa-versa!
  //         network: string   // unique id for the network connected to.
  //         status: string
  //       }, ...
  //     }
  //   }, ... // userIdX
  // }
  // Local client's information.
  'me': {
    'description': '',
    'instanceId': '',
    'keyHash': '',
    'identities': {},
    'networkDefaults' : {
      'google': {'autoconnect': false},
      'facebook': {'autoconnect': false}
    }
  },

  // roster: {
  //   [userIdX]: {
  //     userId: string,
  //     name: string,
  //     url: string,
  //     clients: {
  //       [clientIdX]: {
  //         clientId: string, // same as key [clientIdX].
  //         // TODO: users should live in network, not visa-versa!
  //         network: string
  //         status: string
  //       }, ... clientIdX
  //     },
  //   } ... userIdX
  // }
  // Merged contact lists from each identity provider.
  'roster': {},

  // instances: {
  //   [instanceIdX]: {
  //     // From Network/identity:
  //     name: string,
  //     userId: string,
  //     network: string,
  //     url: string,
  //     // Instance specific
  //     description: string,
  //     // annotation: string, // TODO
  //     instanceId: string,
  //     keyhash: string,
  //     trust: {
  //       asProxy: Trust
  //       asClient: Trust
  //     }
  //     status {
  //       proxy: boolean
  //       client: boolean
  //     }
  //   }
  // }
  // instanceId -> instance. Active UProxy installations.
  'instances': {},

  // ID mappings.
  // TODO: Make these mappings properly properly reflect that an instance can
  // be connected to multiple networks and therefore have multiple client ids.
  // TODO: add mappings between networks?
  'clientToInstance': {},      // instanceId -> clientId
  'instanceToClient': {},      // clientId -> instanceId

  // Options coming from local storage and setable by the options page.
  // TODO: put real values in here.
  'options': {
    // TODO: connect this option to the actual proxy config code.
    'allowNonRoutableAddresses': false,
    // See: https://gist.github.com/zziuni/3741933
    // http://www.html5rocks.com/en/tutorials/webrtc/basics/
    //   'stun:stun.l.google.com:19302'
    // Public Google Stun server:
    //
    'stunServers': ['stun:stun.l.google.com:19302',
                    'stun.services.mozilla.com'],
    // TODO: These may need to be set dynamically. see:
    // https://code.google.com/p/webrtc/source/browse/trunk/samples/js/apprtc/apprtc.py#430
    // e.g. https://computeengineondemand.appspot.com/turn?username=UNIQUE_IDENTIFIER_FROM_ANYWHERE&key=4080218913
    'turnServers': ['turnServer1', 'turnServer2']
  }
};


// DEFAULT_SAVE_STATE defines all fields that should be saved . If something is
// dynamic, it is not in DEFAULT_SAVE_STATE and should not be saved.
var DEFAULT_SAVE_STATE = {
  'me': {
    'description': '',
    'instanceId': '',
    'keyHash': '',
    'networkDefaults' : {}
  },

  'options': {
    'allowNonRoutableAddresses': false,
    'stunServers': ['stun:stun.l.google.com:19302',
                    'stun.services.mozilla.com'],
    'turnServers': ['turnServer1', 'turnServer2']
  }

  // Note: these are empty, so not actually used.
  // 'instances': {},
  // 'instanceIds': [],
};


