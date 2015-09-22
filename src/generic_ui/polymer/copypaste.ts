/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='./context.d.ts' />
/*
 * copypaste.ts
 *
 * This file handles the client interactions for the copypaste portion of the
 * app.
 */
import ui_constants = require('../../interfaces/ui');
import social = require('../../interfaces/social');

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

enum STATE {
  GETTING,
  SHARING,
};

Polymer({
  STATE: STATE,
  init: function() {
    /* bring copyPaste to the front in get mode */
    ui.view = ui_constants.View.COPYPASTE;

    if (ui.copyPasteState.localGettingFromRemote === social.GettingState.NONE) {
      this.startGetting();
    }
  },
  lastState: STATE.SHARING,
  startGetting: function() {
    this.lastState = STATE.GETTING;
    this.gettingResponse = '';

    var doneStopping :Promise<void>;
    if (ui.copyPasteState.localGettingFromRemote !== social.GettingState.NONE) {
      console.warn('aborting previous copy+paste getting connection');
      doneStopping = this.stopGetting();
    } else {
      doneStopping = Promise.resolve<void>();
    }

    doneStopping.then(() => {
      ui.copyPasteMessage = '';
      ui.copyPasteError = ui_constants.CopyPasteError.NONE;
      ui.copyPastePendingEndpoint = null;

      return core.startCopyPasteGet();
    }).then((endpoint) => {
      ui.copyPastePendingEndpoint = endpoint;
    }).catch((e) => {
      // TODO we will see this any time the connection is aborted by the user or
      // when something actually goes wrong with the connection.  We should
      // come up with a good way to differentiate between the two and take
      // appropriate action in those cases.  In most cases, it seems this is not
      // an error, so we are just going to warn about it.

      console.warn('error when starting copy+paste get', e);
      ui.copyPasteError = ui_constants.CopyPasteError.FAILED;
    });
  },
  handleBackClick: function() {
    if (ui.copyPasteState.localGettingFromRemote === social.GettingState.NONE &&
        ui.copyPasteState.localSharingWithRemote === social.SharingState.NONE) {
      ui.view = ui_constants.View.SPLASH;
      return;
    }

    this.fire('open-dialog', {
      heading: ui.i18n_t("GO_BACK"),
      message: ui.i18n_t("ARE_YOU_SURE"),
      buttons: [{
        text: ui.i18n_t("YES"),
        signal: 'copypaste-back'
      }, {
        text: ui.i18n_t("NO"),
        dismissive: true
      }]
    });
  },
  stopGetting: function() {
    ui.stopUsingProxy();
    return core.stopCopyPasteGet().then(() => {
      // clean up the pending endpoint in case we got here from going back
      ui.copyPastePendingEndpoint = null;
    });
  },
  startProxying: function() {
    if (!ui.copyPastePendingEndpoint) {
      console.error('Attempting to start copy+paste proxying without a pending endpoint');
      return;
    }

    if (ui.copyPasteState.localGettingFromRemote !== social.GettingState.GETTING_ACCESS) {
      console.error('Attempting to start copy+paste when not getting access');
      return;
    }

    ui.startGettingInUiAndConfig(null, ui.copyPastePendingEndpoint);
    ui.copyPastePendingEndpoint = null;
  },
  switchToGetting: function() {
    this.stopSharing().then(() => {
      this.startGetting();
    });
  },
  stopSharing: function() {
    this.lastState = STATE.SHARING;
    return core.stopCopyPasteShare();
  },
  select: function(e :Event, d :Object, sender :HTMLInputElement) {
    sender.focus();
    sender.select();
  },
  dismissError: function() {
    ui.copyPasteError = ui_constants.CopyPasteError.NONE;
  },
  exitMode: function() {
    // if we are currently in the middle of setting up a connection, end it
    var doneStopping :Promise<void>;
    if (ui.copyPasteState.localGettingFromRemote !== social.GettingState.NONE) {
      doneStopping = this.stopGetting();
    } else {
      doneStopping = Promise.resolve<void>();
    }

    doneStopping.catch((e) => {
      console.warn('Error while closing getting connection', e);
    }).then(() => {
      if (ui.copyPasteState.localSharingWithRemote !== social.SharingState.NONE) {
        return this.stopSharing();
      }
    }).catch((e) => {
      console.warn('Error while closing sharing connection', e);
    }).then(() => {
      // go back to the previous view regardless of whether we successfully
      // stopped the connection
      ui.view = ui_constants.View.SPLASH;
    })
  },
  encodeMessage: function(message:string) {
    return encodeURIComponent(message);
  },
  gettingResponse: '',
  gettingLinkError: false,
  gettingResponseChanged: function(old :string, link :string) {
    this.showGettingSubmit = false;
    this.gettingLinkError = false;
    if (!link || !link.length) {
      // should have no buttor or error if there is just nothing there
      return;
    }

    var res = ui.parseUrlData(link);
    if (res === null || res.type !== social.PeerMessageType.SIGNAL_FROM_SERVER_PEER) {
      this.gettingLinkError = true;
      return;
    }

    // the link passes a casual inspection, show the submit button
    this.showGettingSubmit = true;
  },
  submitGettingLink: function() {
    ui.handleCopyPasteUrlData(this.gettingResponse);
  },
  ready: function() {
    this.ui = ui;
    this.ui_constants = ui_constants;
    this.model = model;
    this.GettingState = social.GettingState;
    this.SharingState = social.SharingState;
  }
});
