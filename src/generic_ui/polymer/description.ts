/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../../uproxy.ts' />

declare var core :uProxy.CoreAPI;

console.log('loading description ' + model.globalSettings.description);
Polymer({
  model : model,
  update: function() {
    model.globalSettings.description = this.model.globalSettings.description;
    core.updateGlobalSettings(model.globalSettings);
  }
});
