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
    ui_context.core.updateGlobalSettings(ui_context.model.globalSettings);
  },
  cancelEditing: function() {
    this.editing = false;
  },
  ready: function() {
    this.model = ui_context.model;
    this.editing = false;
    this.descriptionInput = '';
  },
  showDescription: function(description :string) {
    return description ? description : ui_context.ui.i18n_t('NAME_THIS_DEVICE');
  }
});
