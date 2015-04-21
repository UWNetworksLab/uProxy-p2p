/// <reference path='./context.d.ts' />

import ui_constants = require('../../interfaces/ui');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');
import user = require('../scripts/user');

Polymer({
  contact: {
    // Must adhere to the typescript interface UI.User.
    name: 'unknown'
  },
  toggle: function() {
    if (this.model.globalSettings.mode == ui_constants.Mode.SHARE) {
      this.contact.shareExpanded = !this.contact.shareExpanded;
    } else if (this.model.globalSettings.mode == ui_constants.Mode.GET) {
      this.contact.getExpanded = !this.contact.getExpanded;
    }
  },
  ready: function() {
    this.ui = browserified_exports.ui;
    this.ui_constants = ui_constants;
    this.model = browserified_exports.model;
    this.GettingConsentState = user.GettingConsentState;
    this.SharingConsentState = user.SharingConsentState;
    this.isTryingToGet = false;
  },
  openLink: function(event :Event) {
    this.ui.browserApi.openTab(this.contact.url);
    event.stopPropagation();  // Don't toggle when link is clicked.
  },
  setIsTryingToGet: function(e :Event, data :{ isTryingToGet :boolean }) {
    this.isTryingToGet = data.isTryingToGet;
  },
  // |action| is the string end for a uproxy_core_api.ConsentUserAction
  modifyConsent: function(action :uproxy_core_api.ConsentUserAction) {
    var command = <uproxy_core_api.ConsentCommand>{
      path: {
        network : {
         name: this.contact.network.name,
         userId: this.contact.network.userId
        },
        userId: this.contact.userId
      },
      action: action
    };
    console.log('[polymer] consent command', command)
    browserified_exports.core.modifyConsent(command);
  },

  // Proxy UserActions.
  request: function() { this.modifyConsent(uproxy_core_api.ConsentUserAction.REQUEST) },
  cancelRequest: function() {
    this.modifyConsent(uproxy_core_api.ConsentUserAction.CANCEL_REQUEST)
  },
  ignoreOffer: function() { this.modifyConsent(uproxy_core_api.ConsentUserAction.IGNORE_OFFER) },
  unignoreOffer: function() { this.modifyConsent(uproxy_core_api.ConsentUserAction.UNIGNORE_OFFER) },

  // Client UserActions
  offer: function() { this.modifyConsent(uproxy_core_api.ConsentUserAction.OFFER) },
  cancelOffer: function() {
    this.ui.stopGivingInUi();
    this.modifyConsent(uproxy_core_api.ConsentUserAction.CANCEL_OFFER);
  },
  ignoreRequest: function() { this.modifyConsent(uproxy_core_api.ConsentUserAction.IGNORE_REQUEST) },
  unignoreRequest: function() { this.modifyConsent(uproxy_core_api.ConsentUserAction.UNIGNORE_REQUEST) }
});
