import uproxy_core_api = require('../../interfaces/uproxy_core_api');

interface BandwidthConfig {
  testing ?: uproxy_core_api.bandwidthSettingsTesting;
}

export = BandwidthConfig;
