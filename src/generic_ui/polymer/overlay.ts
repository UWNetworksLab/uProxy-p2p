/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../scripts/core_connector.ts' />

declare var core :CoreConnector;

Polymer({
  model: model,
  confirmSeen: function() {
    if (!this.hasSeenBefore) {
      console.log('No variable tracking if this overlay has been seen.');
      return;
    }
    model.globalSettings[this.hasSeenBefore] = true;
    core.updateGlobalSettings(model.globalSettings);
  }
});
