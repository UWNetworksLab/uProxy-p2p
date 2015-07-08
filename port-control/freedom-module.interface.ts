/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />

// An object representing a port mapping
export interface Mapping {
    internalIp :string;
    internalPort :number;
    externalIp ?:string;
    externalPort :number;
    lifetime :number;
    protocol :string;
    timeoutId ?:number;
    nonce ?:number[];
}

// An object representing a collection of port mappings
// The interface for the variable activeMappings
export interface ActiveMappings {
    [extPort :string] :Mapping;
}

// Returned by probeProtocolSupport()
export interface ProtocolSupport {
    natPmp :boolean;
    pcp :boolean;
    upnp :boolean;
}

export interface PortControl {
    addMapping(intPort:number, extPort:number, lifetime:number) : Promise<Mapping>;
    deleteMapping(extPort:number) : Promise<boolean>;
    probeProtocolSupport() : Promise<ProtocolSupport>;

    probePmpSupport() : Promise<boolean>;
    addMappingPmp(intPort:number, extPort:number, lifetime:number) : Promise<Mapping>;
    deleteMappingPmp(extPort:number) : Promise<boolean>;

    probePcpSupport() : Promise<boolean>;
    addMappingPcp(intPort:number, extPort:number, lifetime:number) : Promise<Mapping>;
    deleteMappingPcp(extPort:number) : Promise<boolean>;

    probeUpnpSupport() : Promise<boolean>;
    addMappingUpnp(intPort:number, extPort:number, lifetime:number) : Promise<Mapping>;
    deleteMappingUpnp(extPort:number) : Promise<boolean>;

    getActiveMappings() : Promise<ActiveMappings>;
    getPrivateIps() : Promise<string[]>;
    close() : Promise<void>;
}
