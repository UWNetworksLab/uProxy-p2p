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
  settings: '',
  portControlSupport: null,
  reproxyCheck: uproxy_core_api.ReproxyCheck.UNCHECKED,
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

    // Set visuals in "Enable Tor" div based on current global settings
    this.$.torEnableButton.checked = ui_context.model.globalSettings.reproxy.enabled;
    this.torPort = ui_context.model.globalSettings.reproxy.socksEndpoint.port;

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
      // User input values in "Enable Tor" div override JSON blob
      if (this.$.torEnableButton.checked) {
        this.torEnabled = true;
        newSettings.reproxy = {
          enabled: true,
          socksEndpoint: {address: '127.0.0.1', port: this.torPort}
        };
        // Refresh warning check for server listening on input port
        this.refreshReproxyCheck();
      } else {
        this.torEnabled = false;
        newSettings.reproxy.enabled = false;
        ui_context.model.reproxyError = false;  // Reset error and check
        this.reproxyCheck = uproxy_core_api.ReproxyCheck.UNCHECKED;
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
  refreshReproxyCheck: function() {
    this.reproxyCheck = uproxy_core_api.ReproxyCheck.PENDING;
    this.testedTorPort = this.torPort;
    this.$.state.core.checkReproxy(this.testedTorPort)
      .then((check: uproxy_core_api.ReproxyCheck) => {
        this.reproxyCheck = check;
      });
  },
  computed: {
    'opened': '$.advancedSettingsPanel.opened'
  },
  _reproxyCheckToString: function(check: uproxy_core_api.ReproxyCheck) :string {
    switch (check) {
      case uproxy_core_api.ReproxyCheck.UNCHECKED:
        return 'UNCHECKED';
      case uproxy_core_api.ReproxyCheck.PENDING:
        return 'PENDING';
      case uproxy_core_api.ReproxyCheck.TRUE:
        return 'TRUE';
      case uproxy_core_api.ReproxyCheck.FALSE:
        return 'FALSE';
      default:
        return '';
    }
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
