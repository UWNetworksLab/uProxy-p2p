/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../scripts/core_connector.ts' />

declare var core :CoreConnector;

Polymer({
  description: model.globalSettings.description,
  update: function() {
    model.globalSettings.description = this.description;
    core.updateGlobalSettings(model.globalSettings);
  }
});
