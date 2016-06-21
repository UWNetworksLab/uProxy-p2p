import social = require('../interfaces/social');

function lenMinusOne(keys:string[]) :number {
  return keys.length -1;
}

function length(keys:string[]) :number {
  return keys.length;
}

export var NETWORK_OPTIONS :{[name:string]:social.NetworkOptions} = {
  'Quiver': {
    displayName: 'uProxy',
    metricsName: 'quiver',
    rosterFunction: lenMinusOne,
    isFirebase: false,
    enableMonitoring: true,
    areAllContactsUproxy: true,
    supportsReconnect: true,
    isExperimental: true,
    isEncrypted: true
  },
  'Cloud': {
    metricsName: 'cloud',
    rosterFunction: length,
    isFirebase: false,
    enableMonitoring: false,
    areAllContactsUproxy: true,
    supportsReconnect: false,
    isExperimental: true
  }
};
