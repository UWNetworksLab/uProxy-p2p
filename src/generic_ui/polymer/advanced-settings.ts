/// <reference path='./context.d.ts' />

// This class will set our global settings object as a JSON blob. It will
// refresh the value on every open. This should be safe since these settings
// are currently changed by the UI, which would force a reopen. But if we get
// a message from the core that overwrites while this window is open, and the
// user clicks set, we will overwrite the core change.

export enum StatusState {
  EMPTY,
  SET,
  PARSE_ERROR,
  KEY_VALUE_ERROR
};

Polymer({
  settings: '',
  status: StatusState.EMPTY,
  refreshMessageVisibility_: function() {
    this.$.confirmSetAdvancedSettings.hidden =
      (this.status !== StatusState.SET);

    this.$.failedSetAdvancedSettings.hidden =
      (this.status !== StatusState.PARSE_ERROR);

    this.$.failedKeyValueSetAdvancedSettings.hidden =
      (this.status !== StatusState.KEY_VALUE_ERROR);
  },
  jsonifySettings_: function(settingsObject :Object) {
    return JSON.stringify(settingsObject, null, ' ');
  },
  close: function() {
    this.$.advancedSettingsPanel.close();
  },
  open: function() {
    this.settings = this.jsonifySettings_(ui_context.model.globalSettings);
    this.status = StatusState.EMPTY;
    this.$.advancedSettingsPanel.open();
  },
  // Perform rudimentary JSON check for the text settings.
  // We will only check that the number and names of keys are identical.
  // This will fail if the user tries to change key order.
  checkSettings_: function(oldSettings :any, newSettings :any) {
    for (var key in oldSettings){
      if (!(key in newSettings)) {
        this.status = StatusState.KEY_VALUE_ERROR;
        return false;
      }
    }
    for (var key in newSettings){
      if (!(key in oldSettings)) {
        this.status = StatusState.KEY_VALUE_ERROR;
        return false;
      }
    }
    return true;
  },
  setAdvancedSettings: function() {
    try {
      var newSettings = JSON.parse(this.settings);
      if (this.checkSettings_(ui_context.model.globalSettings, newSettings)) {
        ui_context.model.globalSettings = newSettings; 
        this.status = StatusState.SET;
        ui_context.core.updateGlobalSettings(ui_context.model.globalSettings);

        this.settings = this.jsonifySettings_(ui_context.model.globalSettings);
      }
    } catch (e) {
      this.status = StatusState.PARSE_ERROR;
    }

    this.refreshMessageVisibility_();
  },
  computed: {
    'opened': '$.advancedSettingsPanel.opened'
  },
});
