/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

/**
 * Script for the introductory splash screen.
 */

declare var require :(path :string) => Object;

import ui_constants = require('../../interfaces/ui');
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
    METRICS_OPT_IN: 1
  },
  setState: function(state :Number) {
    if (state < 0 || state > Object.keys(this.SPLASH_STATES).length) {
      console.error('Invalid call to setState: ' + state);
      return;
    }
    model.globalSettings.splashState = state;
    core.updateGlobalSettings(model.globalSettings);
  },
  next: function() {
    this.updateSeenMetrics(false);
    ui.view = ui_constants.View.ROSTER;
  },
  prev: function() {
    this.setState(model.globalSettings.splashState - 1);
  },
  updateLanguage: function(event :Event, detail :any, sender :HTMLElement) {
    if (detail.isSelected) {
      var newLanguage = detail.item.getAttribute('languageCode');
      ui.updateLanguage(newLanguage);
      window.location.reload();
    }
  },
  updateSeenMetrics: function(val :Boolean) {
    model.globalSettings.hasSeenMetrics = true;
    model.globalSettings.statsReportingEnabled = val;
    core.updateGlobalSettings(model.globalSettings);
  },
  enableStats: function() {
    return this.updateSeenMetrics(true);
  },
  disableStats: function() {
    return this.updateSeenMetrics(false);
  },
  ready: function() {
    this.model = model;
    this.languages = languages;
  },
};

Polymer(splash);
