/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

import _ = require('lodash');
import user_interface = require('../scripts/ui');

Polymer({
  accountChooserOpen: false,
  connectedNetworks: '',
  displayName: '',
  logOut: function() {
    // logout all networks asynchronously
    ui.logoutAll();
    this.fire('core-signal', {name: 'close-settings'});
  },
  restart: function() {
    core.restart();
  },
  openFeedbackForm: function() {
    this.fire('core-signal', {name: 'open-feedback'});
  },
  openAdvancedSettingsForm: function() {
    this.fire('core-signal', {name: 'open-advanced-settings'});
  },
  networksChanged: function() {
    if (!model.onlineNetworks) {
      return;
    }
    if (model.onlineNetworks.length === 1) {
      this.displayName = ui.getNetworkDisplayName(model.onlineNetworks[0].name);
    }
  },
  updateStatsReportingEnabled: function() {
    core.updateGlobalSettings(model.globalSettings);
  },
  toggleAccountChooser: function() {
    this.accountChooserOpen = !this.accountChooserOpen;
  },
  ready: function() {
    this.ui = ui;
    this.model = model;
  },
  observe: {
    'model.onlineNetworks': 'networksChanged'
  }
});
