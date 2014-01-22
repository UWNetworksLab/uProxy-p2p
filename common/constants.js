// constants
var Constants = (function () {
    function Constants() {
    }
    Constants.DEBUG = true;

    Constants.Trust = {
        NO: 'no',
        REQUESTED: 'requested',
        OFFERED: 'offered',
        YES: 'yes'
    };

    Constants.ProxyState = {
        OFF: 'off',
        READY: 'ready',
        RUNNING: 'running'
    };

    Constants.StateEntries = {
        ME: 'me',
        OPTIONS: 'options',
        INSTANCEIDS: 'instanceIds',
        INSTANCES: 'instances'
    };

    Constants.DEFAULT_PROXY_STATUS = {
        proxy: Constants.ProxyState.OFF,
        client: Constants.ProxyState.OFF
    };

    Constants.DEFAULT_INSTANCE = {
        instanceId: null,
        keyHash: '',
        trust: {
            asProxy: Constants.Trust.NO,
            asClient: Constants.Trust.NO
        },
        status: Constants.DEFAULT_PROXY_STATUS,
        description: '',
        notify: false,
        rosterInfo: {
            userId: '',
            name: '',
            network: '',
            url: ''
        }
    };

    Constants.DEFAULT_STATUS = {
        message: '',
        network: null,
        status: '',
        userId: ''
    };

    Constants.DEFAULT_ROSTER_ENTRY = {
        userId: null,
        name: '',
        url: '',
        imageData: '',
        clients: {}
    };

    Constants.DEFAULT_ROSTER_CLIENT_ENTRY = {
        clientId: '',
        network: '',
        status: ''
    };

    Constants.DEFAULT_MESSAGE_ENVELOPE = {
        fromUserId: null,
        fromClientId: null,
        toUserId: null,
        data: {}
    };

    Constants.DEFAULT_INSTANCE_MESSAGE = {
        type: 'notify-instance',
        instanceId: null,
        description: '',
        keyHash: '',
        rosterInfo: {}
    };

    Constants.DEFAULT_INSTANCE_MESSAGE_ROSTERINFO = {
        name: null,
        network: null,
        url: '',
        userId: ''
    };

    Constants.DEFAULT_MY_IDENTITY = {
        userId: null,
        name: '',
        url: '',
        clients: {}
    };

    Constants.DEFAULT_MY_IDENTITY_CLIENT = {
        clientId: null,
        network: null,
        status: null
    };

    Constants.DEFAULT_ME = {
        // description of this installed instance
        'description': '',
        // id for this installed instance
        'instanceId': '',
        // hash of your public key for peer connections
        'keyHash': '',
        // Specified in DEFAULT_MY_IDENTITY, keyed by userId.
        'identities': {},
        // network connection defaults
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

    Constants.DEFAULT_LOAD_STATE = {
        // debugging stuff
        '_debug': Constants.DEBUG,
        '_msgLog': [],
        // A table from network identifier to your status on that network
        // (online/offline/idle, etc)
        'identityStatus': {},
        // Local client's information.
        'me': Constants.DEFAULT_ME,
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
        'clientToInstance': {},
        'instanceToClient': {},
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
            'stunServers': [
                'stun:stun.l.google.com:19302',
                'stun.services.mozilla.com'
            ],
            // TODO: These may need to be set dynamically. see:
            // https://code.google.com/p/webrtc/source/browse/trunk/samples/js/apprtc/apprtc.py#430
            // e.g. https://computeengineondemand.appspot.com/turn?username=UNIQUE_IDENTIFIER_FROM_ANYWHERE&key=4080218913
            'turnServers': ['turnServer1', 'turnServer2']
        }
    };

    Constants.DEFAULT_SAVE_STATE = {
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
                'stun.services.mozilla.com'
            ],
            'turnServers': ['turnServer1', 'turnServer2']
        }
    };
    return Constants;
})();
