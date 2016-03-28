/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import uproxy_core_api = require('../../interfaces/uproxy_core_api');
import ui_constants = require('../../interfaces/ui');

var ui = ui_context.ui;

const DEFAULT_PROVIDER = 'digitalocean';

Polymer({
  open: function() {
    this.$.getStartedOverlay.open();
  },
  showDigitalOceanAccountHelpOverlay: function() {
    this.closeOverlays();
    this.$.digitalOceanAccountHelpOverlay.open();
  },
  showLoginOverlay: function() {
    this.closeOverlays();
    this.$.loginOverlay.open();
  },
  launchDigitalOceanSignup: function() {
    ui.openTab('https://cloud.digitalocean.com/registrations/new');
  },
  back: function() {
    if (this.$.digitalOceanAccountHelpOverlay.opened ||
        this.$.loginOverlay.opened || this.$.failureOverlay.opened) {
      this.closeOverlays();
      this.$.getStartedOverlay.open();
    } else {
      this.closeOverlays();
    }
  },
  closeOverlays: function() {
    this.$.getStartedOverlay.close();
    this.$.digitalOceanAccountHelpOverlay.close();
    this.$.loginOverlay.close();
    this.$.installingOverlay.close();
    this.$.successOverlay.close();
    this.$.failureOverlay.close();
  },
  loginTapped: function() {
    this.closeOverlays();
    ui.cloudInstallStatus = '';
    this.$.installingOverlay.open();

    ui.cloudUpdate({
      operation: uproxy_core_api.CloudOperationType.CLOUD_INSTALL,
      providerName: DEFAULT_PROVIDER,
      region: this.$.regionMenu.selected
    }).then(() => {
      this.closeOverlays();
      this.$.successOverlay.open();
    }).catch((e: Error) => {
      // TODO: Figure out which fields in e are set, because message isn't.
      this.closeOverlays();
      this.$.failureOverlay.open();
    });
  },
  select: function(e: Event, d: Object, input: HTMLInputElement) {
    input.focus();
    input.select();
  },
  ready: function() {
    this.ui = ui;
  }
});
