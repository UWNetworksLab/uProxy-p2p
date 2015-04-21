/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

Polymer({
  editDescription: function() {
    this.descriptionInput = this.model.globalSettings.description;
    this.editing = true;
  },
  saveDescription: function() {
    this.model.globalSettings.description = this.descriptionInput;
    this.editing = false;
    browserified_exports.core.updateGlobalSettings(browserified_exports.model.globalSettings);
  },
  cancelEditing: function() {
    this.editing = false;
  },
  ready: function() {
    this.model = browserified_exports.model;
    this.editing = false;
    this.descriptionInput = '';
  }
});
