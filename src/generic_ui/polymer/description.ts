/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../scripts/core_connector.ts' />

declare var core :CoreConnector;

Polymer({
  model: model,
  editing: false,
  lastSavedDescription: model.globalSettings.description,
  editDescription: function() {
    this.lastSavedDescription = this.model.globalSettings.description;
    this.editing = true;
  },
  saveDescription: function() {
    this.editing = false;
  },
  cancelEditing: function() {
    this.model.globalSettings.description = this.lastSavedDescription;
    this.editing = false;
  },
  update: function() {
    core.updateGlobalSettings(model.globalSettings);
  }
});
