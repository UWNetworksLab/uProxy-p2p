/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../scripts/core_connector.ts' />

declare var core :CoreConnector;

Polymer({
  update: function() {
    core.updateGlobalSettings(model.globalSettings);
  },
  ready: function() {
    this.model = model;
  }
});
