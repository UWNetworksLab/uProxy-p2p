/// <reference path='../../../third_party/typings/index.d.ts'/>
/// <reference path='./context.d.ts' />

Polymer({
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
  },
  showDescription: function(description :string) {
    return description ? description : ui_context.ui.i18n_t('NAME_THIS_DEVICE');
  }
});
