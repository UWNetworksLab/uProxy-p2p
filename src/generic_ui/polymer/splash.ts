/// <reference path='./context.d.ts' />

/**
 * Script for the introductory splash screen.
 */

declare var require :(path :string) => Object;

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
    NETWORKS: 1
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
    this.setState(model.globalSettings.splashState + 1);
  },
  prev: function() {
    this.setState(model.globalSettings.splashState - 1);
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
  ready: function() {
    this.model = model;
    this.languages = languages;
  },
  openFaqForm: function() {
    this.fire('core-signal', {name: 'open-faq'});
  },
});
