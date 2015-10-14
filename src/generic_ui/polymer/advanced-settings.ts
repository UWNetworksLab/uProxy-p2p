/// <reference path='./context.d.ts' />

// This class will set our global settings object as a JSON blob. It will
// refresh the value on every open. This should be safe since these settings
// are currently changed by the UI, which would force a reopen. But if we get
// a message from the core that overwrites while this window is open, and the
// user clicks set, we will overwrite the core change.

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

import uproxy_core_api = require('../../interfaces/uproxy_core_api');

export enum StatusState {
  EMPTY,
  SET,
  PARSE_ERROR,
  KEY_VALUE_ERROR
};

Polymer({
  StatusState: StatusState,
  settings: '',
  status: StatusState.EMPTY,
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
        return false;
      }
    }
    for (var key in newSettings){
      if (!(key in oldSettings)) {
        return false;
      }
    }
    return true;
  },
  setAdvancedSettings: function() {
    try {
      var newSettings = JSON.parse(this.settings);
      if (!this.checkSettings_(ui_context.model.globalSettings, newSettings)) {
        this.status = StatusState.KEY_VALUE_ERROR;
        return;
      }

      ui_context.model.globalSettings = newSettings;
      this.status = StatusState.SET;
      ui_context.core.updateGlobalSettings(ui_context.model.globalSettings);

      this.settings = this.jsonifySettings_(ui_context.model.globalSettings);
    } catch (e) {
      this.status = StatusState.PARSE_ERROR;
    }
  },
  viewLogs: function() {
    this.ui.openTab('generic_ui/view-logs.html?lang=' + this.model.globalSettings.language);
  },
  ready: function() {
    this.ui = ui;
    this.uproxy_core_api = uproxy_core_api;
    this.model = model;
  },
  refreshPortControl: function() {
    core.refreshPortControlSupport();
  },
  computed: {
    'opened': '$.advancedSettingsPanel.opened'
  },
});
