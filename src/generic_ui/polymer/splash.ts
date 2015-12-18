/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

/**
 * Script for the introductory splash screen.
 */

declare var require :(path :string) => Object;

import ui_constants = require('../../interfaces/ui');
import loginCommon = require('./login-common');
import _ = require('lodash');

interface Language {
  description :string;
  language :string;
  languageCode :string;
}
var languages :Language[] = <Language[]>require('../locales/all/languages.json');

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

var splash = {
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
    } else if (model.globalSettings.hasSeenWelcome &&
        model.globalSettings.splashState == this.SPLASH_STATES.INTRO) {
        // Skip metrics opt-in if we've seen it before.
        this.setState(this.SPLASH_STATES.NETWORKS);
    } else {
      this.setState(model.globalSettings.splashState + 1);
    }
  },
  prev: function() {
    if (model.globalSettings.hasSeenWelcome &&
        model.globalSettings.splashState == this.SPLASH_STATES.NETWORKS) {
        // Skip metrics opt-in if we've seen it before.
        this.setState(this.SPLASH_STATES.INTRO);
    } else {
      this.setState(model.globalSettings.splashState - 1);
    }
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
  enableStats: function() {
    model.globalSettings.statsReportingEnabled = true;
    core.updateGlobalSettings(model.globalSettings);
    this.next();
  },
  disableStats: function() {
    model.globalSettings.statsReportingEnabled = false;
    core.updateGlobalSettings(model.globalSettings);
    this.next();
  },
  observe: {
    'model.networkNames': 'updateNetworkButtonNames',
  },
  ready: function() {
    this.ui = ui;
    this.model = model;
    this.languages = languages;
    this.userName = model.globalSettings.quiverUserName;
    this.updateNetworkButtonNames();
  },
};

(<any>_.mixin)(splash, loginCommon);
Polymer(splash);
