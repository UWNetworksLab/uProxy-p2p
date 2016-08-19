import uproxy_core_api = require('../../interfaces/uproxy_core_api');

interface BandwidthConfig {
  // Includes a number for the limit, as well as a boolean for whether
  // or not the bandwidth should be limited.
  settings ?: uproxy_core_api.bandwidthSettings;
}

export = BandwidthConfig;