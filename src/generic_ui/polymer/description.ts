/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../../uproxy.ts' />

declare var core :uProxy.CoreAPI;

Polymer({
  description: model.globalSettings.description,
  update: function() {
    model.globalSettings.description = this.description;
    core.updateGlobalSettings(model.globalSettings);
  }
});
