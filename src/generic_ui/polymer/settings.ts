/// <reference path='./context.d.ts' />
/// <reference path='../../../third_party/polymer/polymer.d.ts' />

var ui = ui_context.ui;

import * as _ from 'lodash';

import * as model from '../scripts/model';
import * as translator from '../scripts/translator';
import * as user_interface from '../scripts/ui';
import * as dialogs from '../scripts/dialogs';
import * as ui_constants from '../../interfaces/ui';

var languages :Language[] = <Language[]>require('../locales/all/languages.json');
var core = ui_context.core;
var languageSettings = ui_context.model;
interface Language {
  description :string;
  language :string;
  languageCode :string;
}

Polymer({
  accountChooserOpen: false,
  connectedNetwork: '',
  showRestartButton: false,
  showLogoutButton: false,
  logOut: function() {
    // logout all networks asynchronously

    var isGetting = ui.isGettingAccess();
    var isSharing = ui.isGivingAccess();
    var confirmLogout = Promise.resolve();

    if (isGetting || isSharing) {
      const confirmationMessage = dialogs.getLogoutConfirmationMessage(ui.isGettingAccess(), ui.isGivingAccess());
      confirmLogout = this.$.state.openDialog(dialogs.getConfirmationDialogDescription('', confirmationMessage));
    }

    confirmLogout.then(() => {
      return Promise.all(ui_context.model.onlineNetworks.map((network: model.Network) => {
        if (network.name === 'Cloud') {
          return Promise.resolve();  // Don't log out of Cloud.
        }
        return this.$.state.background.logout({
          name: network.name,
          userId: network.userId
        });
      }));
    });

    this.fire('core-signal', {name: 'close-settings'});
  },
  restart: function() {
    this.$.state.background.restart();
  },
  openFeedbackForm: function() {
    this.fire('core-signal', {name: 'open-feedback'});
  },
  openAdvancedSettingsForm: function() {
    this.fire('core-signal', {name: 'open-advanced-settings'});
  },
  networksChanged: function() {
    this.showLogoutButton = this.isUserLoggedIntoNonCloudNetwork();
    if (!ui_context.model.onlineNetworks) {
      return;
    }
    if (ui_context.model.onlineNetworks.length === 1) {
      // Only show a network name if we're connected to one network.
      this.connectedNetwork = ui.getNetworkDisplayName(ui_context.model.onlineNetworks[0].name);
    } else {
      this.connectedNetwork = '';
    }
  },
  isUserLoggedIntoNonCloudNetwork: function() {
    if (!ui_context.model.onlineNetworks) {
      return false;
    }
    for (let i = 0; i < ui_context.model.onlineNetworks.length; ++i) {
      if (ui_context.model.onlineNetworks[i].name !== 'Cloud') {
        return true;
      }
    }
    return false;
  },
  updateStatsReportingEnabled: function() {
    this.$.state.background.updateGlobalSetting('statsReportingEnabled', ui_context.model.globalSettings.statsReportingEnabled);
  },
  toggleAccountChooser: function() {
    this.accountChooserOpen = !this.accountChooserOpen;
  },
  ready: function() {
    this.ui = ui;
    this.model = ui_context.model;
    this.model = languageSettings;
    this.languages = languages;
    this.showRestartButton = (typeof window.chrome) !== 'undefined';
    this.showLogoutButton = this.isUserLoggedIntoNonCloudNetwork();
  },
  observe: {
    'model.onlineNetworks': 'networksChanged'
  },
  updateLanguage: function(event :Event, detail :any, sender :HTMLElement) {
    if (detail.isSelected) {
      var newLanguage = detail.item.getAttribute('languageCode');
      ui.updateLanguage(newLanguage);
      window.location.reload();
    }
  }
});
