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
  keyHash: '',
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

// Default identity.on('onStatus') message
var DEFAULT_STATUS = {
  message: '',
  network: null,
  status: '',
  userId: ''
};

// Default for state.roster
var DEFAULT_ROSTER_ENTRY = {
  userId: null,
  name: '',
  url: '',
  canUProxy: false,
  onGoogle: false,
  onFB: false,
  imageData: {},
  clients: {}  // Specified in DEFAULT_ROSTER_CLIENT_ENTRY
};

// Default for state.roster[*].clients
var DEFAULT_ROSTER_CLIENT_ENTRY = {
  clientId: '',
  network: '',
  status: ''
};

// Any message we get from identity should have this format.
var DEFAULT_MESSAGE_ENVELOPE = {
  fromUserId: null,
  fromClientId: null,
  toUserId: null,
  data: {}
};

// Default for notify-instance messages, not including the envelope.
var DEFAULT_INSTANCE_MESSAGE = {
  type: 'notify-instance',
  instanceId: null,
  description: '',
  keyHash: '',
  rosterInfo: {}
};

// Default for DEFAULT_INSTANCE_MESSAGE.rosterInfo
var DEFAULT_INSTANCE_MESSAGE_ROSTERINFO = {
  name: null,
  network: null,
  url: '',
  userId: ''
};

var DEFAULT_MY_IDENTITY = {
  userId: null,  // should be same as key in DEFAULT_ME.identities[key].
  name: '',  // user-friendly name given by network
  url: '',
  clients: {}  // specified by DEFAULT_MY_IDENTITY_CLIENT.
};

var DEFAULT_MY_IDENTITY_CLIENT = {
  clientId: null,  // string, should be same as DEFAULT_MY_IDENTITY.clients[key]
  network: null,  // string, name of network we're connected to.
  status: null,  // string, online status of identity.
};

var DEFAULT_ME = {
  // description of this installed instance
  'description': '',
  // id for this installed instance
  'instanceId': '',
  // hash of your public key for peer connections
  'keyHash': '',
  // Specified in DEFAULT_MY_IDENTITY, keyed by userId.
  'identities': {},
  // network connection defaults
  'networkDefaults' : {
    'google': {  // identifier for the network
      'autoconnect': false  // whether to connect at startup.
    },
    'facebook': {
      'autoconnect': false
    },
    'xmpp': {
      'autoconnect': false
    }

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

  // Local client's information.
  'me': DEFAULT_ME,

  // roster: {
  //   [userIdX]: {
  //     Specified in DEFAULT_ROSTER_ENTRY.
  // }
  // Merged contact lists from each identity provider.
  'roster': {},

  // instances: {
  //   [instanceId]: {
  //     Specified in DEFAULT_INSTANCE.
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
