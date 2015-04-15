/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
import context = require('../scripts/context');

Polymer({
  editDescription: function() {
    this.descriptionInput = this.model.globalSettings.description;
    this.editing = true;
  },
  saveDescription: function() {
    this.model.globalSettings.description = this.descriptionInput;
    this.editing = false;
    context.core.updateGlobalSettings(model.globalSettings);
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
