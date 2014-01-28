declare module C {
    var DEBUG:boolean;
    var Trust: {
        NO: string;
        REQUESTED: string;
        OFFERED: string;
        YES: string;
    };
    var ProxyState: {
        OFF: string;
        READY: string;
        RUNNING: string;
    };
    var StateEntries: {
        ME: string;
        OPTIONS: string;
        INSTANCEIDS: string;
        INSTANCES: string;
    };
    var DEFAULT_PROXY_STATUS: {
        proxy: string;
        client: string;
    };
    var DEFAULT_INSTANCE: {
        instanceId: any;
        keyHash: string;
        trust: {
            asProxy: string;
            asClient: string;
        };
        status: {
            proxy: string;
            client: string;
        };
        description: string;
        notify: boolean;
        rosterInfo: {
            userId: string;
            name: string;
            network: string;
            url: string;
        };
    };
    var DEFAULT_STATUS: {
        message: string;
        network: string;
        status: string;
        userId: string;
    };
    var DEFAULT_ROSTER_ENTRY: {
        userId: string;
        name: string;
        url: string;
        imageData: string;
        clients: {};
    };
    var DEFAULT_ROSTER_CLIENT_ENTRY: {
        clientId: string;
        network: string;
        status: string;
    };
    var DEFAULT_MESSAGE_ENVELOPE: {
        fromUserId: string;
        fromClientId: string;
        toUserId: string;
        data: {};
    };
    var DEFAULT_INSTANCE_MESSAGE: {
        type: string;
        instanceId: string;
        description: string;
        keyHash: string;
        rosterInfo: {};
    };
    var DEFAULT_INSTANCE_MESSAGE_ROSTERINFO: {
        name: string;
        network: string;
        url: string;
        userId: string;
    };
    var DEFAULT_MY_IDENTITY: {
        userId: string;
        name: string;
        url: string;
        clients: {};
    };
    var DEFAULT_MY_IDENTITY_CLIENT: {
        clientId: string;
        network: string;
        status: string;
    };
    var DEFAULT_ME: {
        'description': string;
        'instanceId': string;
        'keyHash': string;
        'identities': {};
        'networkDefaults': {
            'google': {
                'autoconnect': boolean;
            };
            'facebook': {
                'autoconnect': boolean;
            };
            'xmpp': {
                'autoconnect': boolean;
            };
        };
    };
    var DEFAULT_LOAD_STATE: {
        '_debug': boolean;
        '_msgLog': any[];
        'identityStatus': {};
        'me': {
            'description': string;
            'instanceId': string;
            'keyHash': string;
            'identities': {};
            'networkDefaults': {
                'google': {
                    'autoconnect': boolean;
                };
                'facebook': {
                    'autoconnect': boolean;
                };
                'xmpp': {
                    'autoconnect': boolean;
                };
            };
        };
        'roster': {};
        'instances': {};
        'clientToInstance': {};
        'instanceToClient': {};
        'options': {
            'allowNonRoutableAddresses': boolean;
            'stunServers': string[];
            'turnServers': string[];
        };
    };
    var DEFAULT_SAVE_STATE: {
        'me': {
            'description': string;
            'instanceId': string;
            'keyHash': string;
            'networkDefaults': {};
        };
        'options': {
            'allowNonRoutableAddresses': boolean;
            'stunServers': string[];
            'turnServers': string[];
        };
    };
}
