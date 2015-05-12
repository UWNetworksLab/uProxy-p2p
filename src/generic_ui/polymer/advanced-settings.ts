/// <reference path='./context.d.ts' />

Polymer({
  settings: '',
  close: function() {
    this.$.advancedSettingsPanel.close();
  },
  open: function(e :Event, detail :{ includeLogs: boolean }) {
    this.settings = JSON.stringify(ui_context.model.globalSettings, null, ' ');
    this.$.advancedSettingsPanel.open();
  },
  setAdvancedSettings: function() {
    try {
    ui_context.model.globalSettings = JSON.parse(this.settings);
    }
    catch (e) {
      this.$.failedSetAdvancedSettings.hidden = false;
      this.$.confirmSetAdvancedSettings.hidden = true;
    }

    ui_context.core.updateGlobalSettings(ui_context.model.globalSettings);
    this.$.failedSetAdvancedSettings.hidden = true;
    this.$.confirmSetAdvancedSettings.hidden = false;
  },
  computed: {
    'opened': '$.advancedSettingsPanel.opened'
  },
});
