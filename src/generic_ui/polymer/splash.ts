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
    NETWORKS: 1,
    QUIVER_LOGIN: 2
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
  showQuiverLogin: function() {
    model.globalSettings.splashState = this.SPLASH_STATES.QUIVER_LOGIN;
  },
  loginToQuiver: function() {
    console.log('loginToQuiver called, ' + this.userId);
    // TODO: userId isn't really the right name for this.
    ui.login('Quiver', this.userId).then(() => {
      // Fire an update-view event, which root.ts listens for.
      this.fire('update-view', { view: ui_constants.View.ROSTER });
    }).catch((e :Error) => {
      // TODO: why does this result in an error popup?
      console.warn('Did not log in ', e);
    });
  },
  userId: '',
  ready: function() {
    this.model = model;
    this.languages = languages;
  }
});
