declare module Constants {
    // constructor();
    export var DEBUG:boolean;
    export var Trust: {
        NO: string;
        REQUESTED: string;
        OFFERED: string;
        YES: string;
    };
    export var ProxyState: {
        OFF: string;
        READY: string;
        RUNNING: string;
    };
    export var StateEntries: {
        ME: string;
        OPTIONS: string;
        INSTANCEIDS: string;
        INSTANCES: string;
    };
    export var DEFAULT_PROXY_STATUS: {
        proxy: string;
        client: string;
    };
    export var DEFAULT_INSTANCE: {
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
    export var DEFAULT_STATUS: {
        message: string;
        network: string;
        status: string;
        userId: string;
    };
    export var DEFAULT_ROSTER_ENTRY: {
        userId: string;
        name: string;
        url: string;
        imageData: string;
        clients: {};
    };
    export var DEFAULT_ROSTER_CLIENT_ENTRY: {
        clientId: string;
        network: string;
        status: string;
    };
    export var DEFAULT_MESSAGE_ENVELOPE: {
        fromUserId: string;
        fromClientId: string;
        toUserId: string;
        data: {};
    };
    export var DEFAULT_INSTANCE_MESSAGE: {
        type: string;
        instanceId: string;
        description: string;
        keyHash: string;
        rosterInfo: {};
    };
    export var DEFAULT_INSTANCE_MESSAGE_ROSTERINFO: {
        name: string;
        network: string;
        url: string;
        userId: string;
    };
    export var DEFAULT_MY_IDENTITY: {
        userId: string;
        name: string;
        url: string;
        clients: {};
    };
    export var DEFAULT_MY_IDENTITY_CLIENT: {
        clientId: string;
        network: string;
        status: string;
    };
    export var DEFAULT_ME: {
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
    export var DEFAULT_LOAD_STATE: {
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
    export var DEFAULT_SAVE_STATE: {
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
