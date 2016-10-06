import * as social from '../interfaces/social';

function lenMinusOne(keys:string[]) :number {
  return keys.length -1;
}

function length(keys:string[]) :number {
  return keys.length;
}

export var NETWORK_OPTIONS :{[name:string]:social.NetworkOptions} = {
  'Facebook-Firebase-V2': {
    displayName: 'Facebook',
    metricsName: 'facebook',
    rosterFunction: lenMinusOne,
    isFirebase: true,
    enableMonitoring: true,
    areAllContactsUproxy: true,
    supportsReconnect: true
  },
  'GMail': {
    displayName: 'Gmail',  // fix incorrect capitalization "GMail"
    metricsName: 'gmail',
    rosterFunction: lenMinusOne,
    isFirebase: true,
    enableMonitoring: true,
    areAllContactsUproxy: true,
    supportsReconnect: true
  },
  'WeChat': {
    isFirebase: false,
    metricsName: 'wechat',
    rosterFunction: lenMinusOne,
    enableMonitoring: false,
    areAllContactsUproxy: false,
    supportsReconnect: false,
  },
  'GitHub': {
    metricsName: 'github',
    rosterFunction: lenMinusOne,
    isFirebase: false,
    enableMonitoring: false,
    areAllContactsUproxy: true,
    supportsReconnect: false,
  },
  'Quiver': {
    displayName: 'uProxy',
    metricsName: 'quiver',
    rosterFunction: lenMinusOne,
    isFirebase: false,
    enableMonitoring: true,
    areAllContactsUproxy: true,
    supportsReconnect: true,
    isEncrypted: true
  },
  'Cloud': {
    metricsName: 'cloud',
    rosterFunction: length,
    isFirebase: false,
    enableMonitoring: false,
    areAllContactsUproxy: true,
    supportsReconnect: false,
  }
};
