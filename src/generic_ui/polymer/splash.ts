/// <reference path='./context.d.ts' />
/// <reference path='../../../third_party/polymer/polymer.d.ts' />

/**
 * Script for the introductory splash screen.
 */

declare var require :(path :string) => Object;

import * as ui_constants from '../../interfaces/ui';
import * as translator from '../scripts/translator';
import * as _ from 'lodash';

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
  state: 0,
  SPLASH_STATES: {
    INTRO: 0,
    METRICS_OPT_IN: 1
  },
  backToIntro: function() {
    this.state = this.SPLASH_STATES.INTRO;
  },
  goToStats: function() {
    this.state = this.SPLASH_STATES.METRICS_OPT_IN;
  },
  updateLanguage: function(event :Event, detail :any, sender :HTMLElement) {
    if (detail.isSelected) {
      var curLanguage = this.model.globalSettings.language;
      var newLanguage = detail.item.getAttribute('languageCode');
      if (newLanguage !== curLanguage) {
        translator.i18n_setLng(newLanguage);
        ui.updateLanguage(newLanguage);
      }
    }
  },
  updateMetricsCollection: function(val :Boolean) {
    model.globalSettings.hasSeenMetrics = true;
    this.$.state.background.updateGlobalSetting('hasSeenMetrics', true);
    model.globalSettings.statsReportingEnabled = val;
    this.$.state.background.updateGlobalSetting('statsReportingEnabled', val);
    ui.view = ui_constants.View.ROSTER;
  },
  enableStats: function() {
    return this.updateMetricsCollection(true);
  },
  disableStats: function() {
    return this.updateMetricsCollection(false);
  },
  open: function() {
    this.settings = this.jsonifySettings_(ui_context.model.globalSettings);
  },
  ready: function() {
    this.model = model;
    this.languages = languages;
    var curLanguage = this.model.globalSettings.language;
    for (let i = 0, lang = languages[0]; lang; lang = languages[++i]) {
      if (lang.languageCode === curLanguage) {
        this.langIndex = i;
        break;
      }
    }
  },
});
