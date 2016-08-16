import uproxy_core_api = require('../../interfaces/uproxy_core_api');

interface BandwidthConfig {
  settings ?: uproxy_core_api.bandwidthSettings;
}

export = BandwidthConfig;
