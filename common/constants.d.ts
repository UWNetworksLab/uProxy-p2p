declare class Constants {
    constructor();
    static DEBUG: boolean;
    static Trust: {
        NO: string;
        REQUESTED: string;
        OFFERED: string;
        YES: string;
    };
    static ProxyState: {
        OFF: string;
        READY: string;
        RUNNING: string;
    };
    static StateEntries: {
        ME: string;
        OPTIONS: string;
        INSTANCEIDS: string;
        INSTANCES: string;
    };
    static DEFAULT_PROXY_STATUS: {
        proxy: string;
        client: string;
    };
    static DEFAULT_INSTANCE: {
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
    static DEFAULT_STATUS: {
        message: string;
        network: string;
        status: string;
        userId: string;
    };
    static DEFAULT_ROSTER_ENTRY: {
        userId: string;
        name: string;
        url: string;
        imageData: string;
        clients: {};
    };
    static DEFAULT_ROSTER_CLIENT_ENTRY: {
        clientId: string;
        network: string;
        status: string;
    };
    static DEFAULT_MESSAGE_ENVELOPE: {
        fromUserId: string;
        fromClientId: string;
        toUserId: string;
        data: {};
    };
    static DEFAULT_INSTANCE_MESSAGE: {
        type: string;
        instanceId: string;
        description: string;
        keyHash: string;
        rosterInfo: {};
    };
    static DEFAULT_INSTANCE_MESSAGE_ROSTERINFO: {
        name: string;
        network: string;
        url: string;
        userId: string;
    };
    static DEFAULT_MY_IDENTITY: {
        userId: string;
        name: string;
        url: string;
        clients: {};
    };
    static DEFAULT_MY_IDENTITY_CLIENT: {
        clientId: string;
        network: string;
        status: string;
    };
    static DEFAULT_ME: {
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
    static DEFAULT_LOAD_STATE: {
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
    static DEFAULT_SAVE_STATE: {
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
