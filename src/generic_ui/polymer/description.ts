/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../scripts/core_connector.ts' />

declare var core :CoreConnector;

Polymer({
  model: model,
  update: function() {
    core.updateGlobalSettings(model.globalSettings);
  }
});
