/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

var ui = ui_context.ui;

import _ = require('lodash');

import model = require('../scripts/model');
import translator = require('../scripts/translator');
import user_interface = require('../scripts/ui');
import dialogs = require('../scripts/dialogs');
import ui_constants = require('../../interfaces/ui');


  // // ElleTest begin
  var languages :Language[] = <Language[]>require('../locales/all/languages.json');
  // ElleTest end
  // ElleTest begin
  var core = ui_context.core;
  var elleTest = ui_context.model;
  // // ElleTest end
interface Language {
  description :string;
  language :string;
  languageCode :string;
}

Polymer({



  accountChooserOpen: false,
  connectedNetworks: '',
  logOut: function() {
    // logout all networks asynchronously

    var isGetting = ui.isGettingAccess();
    var isSharing = ui.isGivingAccess();
    var confirmationMessage: string = null;
    var confirmLogout = Promise.resolve<void>();


    

    if (isGetting || isSharing) {
      var confirmationMessage = dialogs.getLogoutConfirmationMessage(ui.isGettingAccess(), ui.isGivingAccess());
      confirmLogout = this.$.state.openDialog(dialogs.getConfirmationDialogDescription('', confirmationMessage));
    }

    confirmLogout.then(() => {
      return Promise.all(ui_context.model.onlineNetworks.map((network: model.Network) => {
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
  // ElleTest begin
  // openLanguageForm: function() {
  //   this.fire('core-signal', {name: 'open-splash'});
  // },
  // ElleTest end
  networksChanged: function() {
    if (!ui_context.model.onlineNetworks) {
      return;
    }
    if (ui_context.model.onlineNetworks.length === 0) {
      this.connectedNetworks = translator.i18n_t('NOT_CONNECTED_LOGIN_TO_START');
    } else if (ui_context.model.onlineNetworks.length === 1) {
      var displayName = ui.getNetworkDisplayName(ui_context.model.onlineNetworks[0].name);
      this.connectedNetworks = translator.i18n_t('CONNECTED_WITH', {network: displayName});
    } else {
      this.connectedNetworks = translator.i18n_t('CONNECTED_WITH_NUMBER', {number: ui_context.model.onlineNetworks.length});
    }
  },
  updateStatsReportingEnabled: function() {
    this.$.state.background.updateGlobalSettings(ui_context.model.globalSettings);
  },
  toggleAccountChooser: function() {
    this.accountChooserOpen = !this.accountChooserOpen;
  },
  ready: function() {
    this.ui = ui;
    this.model = ui_context.model;
    // // ElleTest begin
    this.model = elleTest;
    this.languages = languages;
    // // ElleTest end

  },
  observe: {
    'model.onlineNetworks': 'networksChanged'
  },
  // // ElleTest begin
  setState: function(state :Number) {
    if (state < 0 || state > Object.keys(this.SPLASH_STATES).length) {
      console.error('Invalid call to setState: ' + state);
      return;
    }
    elleTest.globalSettings.splashState = state;
    core.updateGlobalSettings(elleTest.globalSettings);
  },
  next: function() {
    if (elleTest.globalSettings.splashState == this.SPLASH_STATES.METRICS_OPT_IN) {
      ui.view = ui_constants.View.ROSTER;
    } else {
      this.setState(elleTest.globalSettings.splashState + 1);
    }
  },
  prev: function() {
    this.setState(elleTest.globalSettings.splashState - 1);
  },
  updateLanguage: function(event :Event, detail :any, sender :HTMLElement) {
    if (detail.isSelected) {
      var newLanguage = detail.item.getAttribute('languageCode');
      ui.updateLanguage(newLanguage);
      window.location.reload();
    }
  },
  updateSeenMetrics: function(val :Boolean) {
    elleTest.globalSettings.hasSeenMetrics = true;
    elleTest.globalSettings.statsReportingEnabled = val;
    core.updateGlobalSettings(elleTest.globalSettings);
    this.next();
  },
  enableStats: function() {
    return this.updateSeenMetrics(true);
  },
  disableStats: function() {
    return this.updateSeenMetrics(false);
  }
  // // ElleTest end
});
