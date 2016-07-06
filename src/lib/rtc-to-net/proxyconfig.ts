/// <reference path='../../../../third_party/typings/browser.d.ts' />

import uproxy_core_api = require('../../interfaces/uproxy_core_api');

interface ProxyConfig {
  // If |allowNonUnicast === false| then any proxy attempt that results
  // in a non-unicast (e.g. local network) address will fail.
  allowNonUnicast :boolean;
  socksProxySettings ?:uproxy_core_api.SocksProxySettings;
}

export = ProxyConfig;
