module C {
  export var DEBUG = true;

  export var Trust = {
      NO: 'no',
      REQUESTED: 'requested',
      OFFERED: 'offered',
      YES: 'yes'
  };

  export var ProxyState = {
      OFF: 'off',
      READY: 'ready',
      RUNNING: 'running'
  };

  export var StateEntries = {
      ME: 'me',
      OPTIONS: 'options',
      INSTANCEIDS: 'instanceIds',
      INSTANCES: 'instances'
  };

  export var DEFAULT_PROXY_STATUS = {
      proxy: C.ProxyState.OFF,
      client: C.ProxyState.OFF
  };

  export var DEFAULT_INSTANCE = {
      instanceId: null,
      keyHash: '',
      trust: {
          asProxy: Trust.NO,
          asClient: Trust.NO
      },
      status: C.DEFAULT_PROXY_STATUS,
      description: '',
      notify: false,
      rosterInfo: {
          userId: '',
          name: '',
          network: '',
          url: ''
      }
  };

  export var DEFAULT_STATUS = {
      message: '',
      network: null,
      status: '',
      userId: ''
  };

  export var DEFAULT_ROSTER_ENTRY = {
      userId: null,
      name: '',
      url: '',
      imageData: '',
      clients: {}
  };

  export var DEFAULT_ROSTER_CLIENT_ENTRY = {
      clientId: '',
      network: '',
      status: ''
  };

  export var DEFAULT_MESSAGE_ENVELOPE = {
      fromUserId: null,
      fromClientId: null,
      toUserId: null,
      data: {}
  };

  export var DEFAULT_INSTANCE_MESSAGE = {
      type: 'notify-instance',
      instanceId: null,
      description: '',
      keyHash: '',
      rosterInfo: {}
  };

  export var DEFAULT_INSTANCE_MESSAGE_ROSTERINFO = {
      name: null,
      network: null,
      url: '',
      userId: ''
  };

  export var DEFAULT_MY_IDENTITY = {
      userId: null,
      name: '',
      url: '',
      clients: {}
  };

  export var DEFAULT_MY_IDENTITY_CLIENT = {
      clientId: null,
      network: null,
      status: null
  };

  export var DEFAULT_ME = {
      'description': '',
      'instanceId': '',
      'keyHash': '',
      'identities': {},
      'networkDefaults': {
          'google': {
              'autoconnect': false
          },
          'facebook': {
              'autoconnect': false
          },
          'xmpp': {
              'autoconnect': false
          }
      }
  };

  export var DEFAULT_LOAD_STATE = {
      '_debug': C.DEBUG,
      '_msgLog': [],
      'identityStatus': {},
      'me': C.DEFAULT_ME,
      'roster': {},
      'instances': {},
      'clientToInstance': {},
      'instanceToClient': {},
      'options': {
          'allowNonRoutableAddresses': false,
          'stunServers': [
              'stun:stun.l.google.com:19302',
              'stun.services.mozilla.com'],
          'turnServers': ['turnServer1', 'turnServer2']
      }
  };

  export var DEFAULT_SAVE_STATE = {
      'me': {
          'description': '',
          'instanceId': '',
          'keyHash': '',
          'networkDefaults': {}
      },
      'options': {
          'allowNonRoutableAddresses': false,
          'stunServers': [
              'stun:stun.l.google.com:19302',
              'stun.services.mozilla.com'],
          'turnServers': ['turnServer1', 'turnServer2']
      }
  };

}  // module C
