/// <reference path='./context.d.ts' />

// TODO:Reviewer I copied this from settings.tx. Should both files use this.core as specified in ready()?
var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

Polymer({
  settings: JSON.stringify(model.globalSettings, null, ' '),
  close: function() {
    this.$.feedbackPanel.close();
  },
  open: function(e :Event, detail :{ includeLogs: boolean }) {
    this.$.advancedSettingsPanel.open();
  },
  setAdvancedSettings: function() {
    this.model.globalSettings = JSON.parse(this.advancedSettings);
    // TODO: Catch errors.
    core.updateGlobalSettings(model.globalSettings);
    // TODO: Add confirmation back in.
    // if(!this.$.confirmResetAdvancedSettings.hidden) {
    //   this.$.confirmResetAdvancedSettings.hidden = true;
    // }
    // this.$.confirmUpdateAdvancedSettings.hidden = false;
  },
  ready: function() {
    this.ui = ui_context.ui;
    this.model = ui_context.model;
  },
  computed: {
    'opened': '$.advancedSettingsPanel.opened'
  },
});
