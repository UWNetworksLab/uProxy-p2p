/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
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
   // this.ui.openTab('generic_ui/view-logs.html?lang=' + this.model.globalSettings.language);
    this.fire('core-signal', { name: 'open-logs' });
  },
  ready: function() {
    this.ui = ui;
    this.model = model;
  },
  refreshPortControl: function() {
    core.refreshPortControlSupport();
  },
  computed: {
    'opened': '$.advancedSettingsPanel.opened'
  },
  _supportsPortControl: function(supportStatus: uproxy_core_api.PortControlSupport) {
    return supportStatus === uproxy_core_api.PortControlSupport.TRUE;
  },
  _doesNotSupportPortControl: function(supportStatus: uproxy_core_api.PortControlSupport) {
    return supportStatus === uproxy_core_api.PortControlSupport.FALSE;
  },
  _portControlStatusPending: function(supportStatus: uproxy_core_api.PortControlSupport) {
    return supportStatus === uproxy_core_api.PortControlSupport.PENDING;
  },
  _statusStateIsSet: function(statusState: StatusState) {
    return statusState === StatusState.SET;
  },
  _statusStateIsParseErorr: function(statusState: StatusState) {
    return statusState === StatusState.PARSE_ERROR;
  },
  _statusStateIsKeyValueError: function(statusState: StatusState) {
    return statusState === StatusState.KEY_VALUE_ERROR;
  }
});
