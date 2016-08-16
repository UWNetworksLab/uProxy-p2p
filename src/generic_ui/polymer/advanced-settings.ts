/// <reference path='../../../third_party/polymer/polymer.d.ts' />
/// <reference path='./context.d.ts' />

// This class will set our global settings object as a JSON blob. It will
// refresh the value on every open. This should be safe since these settings
// are currently changed by the UI, which would force a reopen. But if we get
// a message from the core that overwrites while this window is open, and the
// user clicks set, we will overwrite the core change.

import uproxy_core_api = require('../../interfaces/uproxy_core_api');

export enum StatusState {
  EMPTY,
  SET,
  PARSE_ERROR,
  KEY_VALUE_ERROR
};

Polymer({
  bandwidthLimit: 0,
  settings: '',
  portControlSupport: null,
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

    if (this.portControlSupport === null) {
      this.refreshPortControl();
    }

    this.bandwidthLimit = ui_context.model.globalSettings.bandwidthSettings.limit;    

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
      if (this.$.bandwidthLimitEnabled.checked) {
        newSettings.bandwidthSettings.enabled = true;
      } else {
        newSettings.bandwidthSettings.enabled = false;
      }
      ui_context.model.globalSettings = newSettings;
      this.status = StatusState.SET;
      this.$.state.core.updateGlobalSettings(ui_context.model.globalSettings);

      this.settings = this.jsonifySettings_(ui_context.model.globalSettings);
    } catch (e) {
      this.status = StatusState.PARSE_ERROR;
    }
  },
  viewLogs: function() {
   // calls logs.html to open the logs
    this.fire('core-signal', { name: 'open-logs' });
  },
  refreshPortControl: function() {
    this.portControlSupport = uproxy_core_api.PortControlSupport.PENDING;
    this.$.state.core.getPortControlSupport().then((support: uproxy_core_api.PortControlSupport) => {
      this.portControlSupport = support;
    });
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
