/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../../uproxy.ts' />

declare var core :uProxy.CoreAPI;

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
