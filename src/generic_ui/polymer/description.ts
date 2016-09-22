/// <reference path='./context.d.ts' />
/// <reference path='../../../third_party/polymer/polymer.d.ts' />

Polymer('uproxy-description', {
  editDescription: function() {
    this.descriptionInput = this.model.globalSettings.description;
    this.editing = true;
  },
  saveDescription: function() {
    this.model.globalSettings.description = this.descriptionInput;
    this.$.state.background.updateGlobalSetting('description', this.descriptionInput);
    this.editing = false;
  },
  cancelEditing: function() {
    this.editing = false;
  },
  ready: function() {
    this.model = ui_context.model;
    this.editing = false;
    this.descriptionInput = '';
  }
});
