import uproxy_core_api = require('../interfaces/uproxy_core_api');

// For the test build, we skip the metrics opt-in to avoid contaminating our
// usage metrics.
export function modifySettings(settings :uproxy_core_api.GlobalSettings) :void {
  settings.hasSeenMetrics = true;
}
