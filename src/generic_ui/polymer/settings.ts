/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

import _ = require('lodash');
import user_interface = require('../scripts/ui');

Polymer({
  accountChooserOpen: false,
  networkNames: '',
  logOut: function() {
    // logout all networks asynchronously
    for (var i in model.onlineNetworks) {
      ui.logout({
        name: model.onlineNetworks[i].name,
        userId: model.onlineNetworks[i].userId
      }).catch((e :Error) => {
        console.error('logout returned error: ', e);
      });
    }
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
      this.networkNames = model.onlineNetworks[0].name;
    } else if (model.onlineNetworks.length === 2) {
      this.networkNames = model.onlineNetworks[0].name + ' and ' + model.onlineNetworks[1].name;
    } else {
      this.networkNames = '';
      for (var i in model.onlineNetworks) {
        // the key is a string, use a soft equality checker here
        if (i == model.onlineNetworks.length - 1) {
          this.networkNames += 'and ' + model.onlineNetworks[i].name;
        } else {
          this.networkNames += model.onlineNetworks[i].name + ', ';
        }
      }
    }
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
