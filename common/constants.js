var C;
(function (C) {
    C.DEBUG = true;

    C.Trust = {
        NO: 'no',
        REQUESTED: 'requested',
        OFFERED: 'offered',
        YES: 'yes'
    };

    C.ProxyState = {
        OFF: 'off',
        READY: 'ready',
        RUNNING: 'running'
    };

    C.StateEntries = {
        ME: 'me',
        OPTIONS: 'options',
        INSTANCEIDS: 'instanceIds',
        INSTANCES: 'instances'
    };

    C.DEFAULT_PROXY_STATUS = {
        proxy: C.ProxyState.OFF,
        client: C.ProxyState.OFF
    };

    C.DEFAULT_INSTANCE = {
        instanceId: null,
        keyHash: '',
        trust: {
            asProxy: C.Trust.NO,
            asClient: C.Trust.NO
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

    C.DEFAULT_STATUS = {
        message: '',
        network: null,
        status: '',
        userId: ''
    };

    C.DEFAULT_ROSTER_ENTRY = {
        userId: null,
        name: '',
        url: '',
        imageData: '',
        clients: {}
    };

    C.DEFAULT_ROSTER_CLIENT_ENTRY = {
        clientId: '',
        network: '',
        status: ''
    };

    C.DEFAULT_MESSAGE_ENVELOPE = {
        fromUserId: null,
        fromClientId: null,
        toUserId: null,
        data: {}
    };

    C.DEFAULT_INSTANCE_MESSAGE = {
        type: 'notify-instance',
        instanceId: null,
        description: '',
        keyHash: '',
        rosterInfo: {}
    };

    C.DEFAULT_INSTANCE_MESSAGE_ROSTERINFO = {
        name: null,
        network: null,
        url: '',
        userId: ''
    };

    C.DEFAULT_MY_IDENTITY = {
        userId: null,
        name: '',
        url: '',
        clients: {}
    };

    C.DEFAULT_MY_IDENTITY_CLIENT = {
        clientId: null,
        network: null,
        status: null
    };

    C.DEFAULT_ME = {
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

    C.DEFAULT_LOAD_STATE = {
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

    C.DEFAULT_SAVE_STATE = {
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
})(C || (C = {}));
