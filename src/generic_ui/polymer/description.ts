/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../scripts/core_connector.ts' />

declare var core :CoreConnector;

Polymer({
  editDescription: function() {
    this.descriptionInput = this.model.globalSettings.description;
    this.editing = true;
  },
  saveDescription: function() {
    this.model.globalSettings.description = this.descriptionInput;
    this.editing = false;
    core.updateGlobalSettings(model.globalSettings);
  },
  cancelEditing: function() {
    this.editing = false;
  },
  ready: function() {
    this.model = model;
    this.editing = false;
    this.descriptionInput = '';
  }
});
