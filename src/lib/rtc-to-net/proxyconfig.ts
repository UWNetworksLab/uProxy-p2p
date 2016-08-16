/// <reference path='../../../third_party/typings/index.d.ts' />

import uproxy_core_api = require('../../interfaces/uproxy_core_api');

interface ProxyConfig {
  // If |allowNonUnicast === false| then any proxy attempt that results
  // in a non-unicast (e.g. local network) address will fail.
  allowNonUnicast :boolean;
  reproxy        ?:uproxy_core_api.reproxySettings;
  testing ?: string;
}

export = ProxyConfig;
