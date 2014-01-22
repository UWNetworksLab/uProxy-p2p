var Constants;
(function (Constants) {
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

    Constants.DEFAULT_LOAD_STATE = {
        '_debug': Constants.DEBUG,
        '_msgLog': [],
        'identityStatus': {},
        'me': Constants.DEFAULT_ME,
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
                'stun.services.mozilla.com'],
            'turnServers': ['turnServer1', 'turnServer2']
        }
    };
})(Constants || (Constants = {}));
