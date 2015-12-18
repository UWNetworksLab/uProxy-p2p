/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

/**
 * Script for the introductory splash screen.
 */

declare var require :(path :string) => Object;

import ui_constants = require('../../interfaces/ui');

interface Language {
  description :string;
  language :string;
  languageCode :string;
}
var languages :Language[] = <Language[]>require('../locales/all/languages.json');

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

Polymer({
  SPLASH_STATES: {
    INTRO: 0,
    METRICS_OPT_IN: 1,
    NETWORKS: 2
  },
  setState: function(state :Number) {
    if (state < 0 || state > Object.keys(this.SPLASH_STATES).length) {
      console.error('Invalid call to setState: ' + state);
      return;
    }
    model.globalSettings.splashState = state;
    core.updateGlobalSettings(model.globalSettings);
  },
  // TODO: Remove the if and else if blocks for next() and prev() when we
  // remove the NETWORKS splash state.
  next: function() {
    if (this.supportsQuiver && model.globalSettings.splashState
        == this.SPLASH_STATES.METRICS_OPT_IN) {
      ui.view = ui_constants.View.ROSTER;
    } else if (model.globalSettings.hasSeenMetrics &&
        model.globalSettings.splashState == this.SPLASH_STATES.INTRO) {
        // Skip metrics opt-in if we've seen it before.
        this.setState(this.SPLASH_STATES.NETWORKS);
    } else {
      this.setState(model.globalSettings.splashState + 1);
    }
  },
  prev: function() {
    if (model.globalSettings.hasSeenMetrics &&
        model.globalSettings.splashState == this.SPLASH_STATES.NETWORKS) {
        // Skip metrics opt-in if we've seen it before.
        this.setState(this.SPLASH_STATES.INTRO);
    } else {
      this.setState(model.globalSettings.splashState - 1);
    }
  },
  copypaste: function() {
    this.fire('core-signal', { name: 'copypaste-init' });
  },
  openFeedbackForm: function() {
    this.fire('core-signal', {name: 'open-feedback'});
  },
  updateLanguage: function(event :Event, detail :any, sender :HTMLElement) {
    if (detail.isSelected) {
      var newLanguage = detail.item.getAttribute('languageCode');
      ui.updateLanguage(newLanguage);
      window.location.reload();
    }
  },
  loginToQuiver: function() {
    model.globalSettings.quiverUserName = this.userName;
    core.updateGlobalSettings(model.globalSettings);
    this.login('Quiver', this.userName);
  },
  loginTapped: function(event: Event, detail: Object, target: HTMLElement) {
    var networkName = target.getAttribute('data-network');
    this.login(networkName);
  },
  login: function(networkName :string, userName ?:string) {
    ui.login(networkName, userName).then(() => {
      // syncNetwork will update the view to the ROSTER.
      ui.bringUproxyToFront();
    }).catch((e: Error) => {
      console.warn('Did not log in ', e);
    });
  },
  getNetworkDisplayName: function(name :string) {
    return ui.getNetworkDisplayName(name);
  },
  isExperimentalNetwork: function(name :string) {
    return ui.isExperimentalNetwork(name);
  },
  updateNetworkButtonNames: function() {
    this.networkButtonNames = _.filter(model.networkNames, (name) => {
      // we do not want a button for Quiver
      return name !== 'Quiver';
    });
    this.supportsQuiver = model.hasQuiverSupport();
  },
  updateStats: function(val :Boolean) {
    model.globalSettings.hasSeenMetrics = true;
    model.globalSettings.statsReportingEnabled = val;
    core.updateGlobalSettings(model.globalSettings);
    this.next();
  },
  enableStats: function() {
    return this.updateStats(true);
  },
  disableStats: function() {
    return this.updateStats(false);
  },
  observe: {
    'model.networkNames': 'updateNetworkButtonNames'
  },
  ready: function() {
    this.ui = ui;
    this.model = model;
    this.languages = languages;
    this.userName = model.globalSettings.quiverUserName;
    this.updateNetworkButtonNames();
  },
});
