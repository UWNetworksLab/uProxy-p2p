/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import social = require('../../interfaces/social');
import ui_types = require('../../interfaces/ui');
import user_interface = require('../scripts/ui');

interface button_description {
  text :string;
  signal :string;
  dismissive :boolean;
}

interface dialog_description {
  heading :string;
  message :string;
  buttons: button_description[];
}

Polymer({
  dialog: {
    message: '',
    heading: '',
    buttons: []
  },
  updateView: function(e :Event, detail :{ view :ui_types.View }) {
    // If we're switching from the SPLASH page to the ROSTER, fire an
    // event indicating the user has logged in. roster.ts listens for
    // this event.
    if (detail.view == ui_types.View.ROSTER && browserified_exports.ui.view == ui_types.View.SPLASH) {
      this.fire('core-signal', {name: "login-success"});
      this.closeSettings();
      this.$.modeTabs.updateBar();
    }
    browserified_exports.ui.view = detail.view;
  },
  closeSettings: function() {
    this.$.mainPanel.closeDrawer();
  },
  rosterView: function() {
    console.log('rosterView called');
    browserified_exports.ui.view = ui_types.View.ROSTER;
  },
  setGetMode: function() {
    browserified_exports.model.globalSettings.mode = ui_types.Mode.GET;
    browserified_exports.core.updateGlobalSettings(browserified_exports.model.globalSettings);
  },
  setShareMode: function() {
    browserified_exports.model.globalSettings.mode = ui_types.Mode.SHARE;
    browserified_exports.core.updateGlobalSettings(browserified_exports.model.globalSettings);
  },
  closedWelcome: function() {
    browserified_exports.model.globalSettings.hasSeenWelcome = true;
    browserified_exports.core.updateGlobalSettings(browserified_exports.model.globalSettings);
  },
  closedSharing: function() {
    browserified_exports.model.globalSettings.hasSeenSharingEnabledScreen = true;
    browserified_exports.core.updateGlobalSettings(browserified_exports.model.globalSettings);
  },
  dismissCopyPasteError: function() {
    browserified_exports.ui.copyPasteError = ui_types.CopyPasteError.NONE;
  },
  openDialog: function(e :Event, detail :dialog_description) {
    /* 'detail' parameter holds the data that was passed when the open-dialog
     * signal was fired. It should be of the form:
     *
     * { heading: 'title for the dialog',
     *   message: 'main message for the dialog',
     *   buttons: [{
     *     text: 'button text, e.g. Done',
     *     signal: 'core-signal to fire when button is clicked (optional)',
     *     dismissive: boolean, whether button is dismissive (optional)
     *   }]
     * }
     */

    this.dialog = detail;
    // Using async() allows the contents of the dialog to update before
    // it's opened. Opening the dialog too early causes it to be positioned
    // incorrectly (i.e. off center).
    this.async(() => {
      this.$.dialog.open();
    });
  },
  dialogButtonClick: function(event :Event, detail :Object, target :HTMLElement) {
    var signal = target.getAttribute('data-signal');
    if (signal) {
      this.fire('core-signal', { name: signal });
    }
  },
  ready: function() {
    // Expose global ui object and UI module in this context.
    this.ui = browserified_exports.ui;
    this.ui_constants = ui_types;
    this.user_interface = user_interface;
    this.model = browserified_exports.model;
    this.closeToastTimeout = null;
    if (browserified_exports.ui.browserApi.browserSpecificElement){
      var browserCustomElement = document.createElement(browserified_exports.ui.browserApi.browserSpecificElement);
      this.$.browserElementContainer.appendChild(browserCustomElement);
    }
  },
  tabSelected: function(e :Event) {
    // setting the value is taken care of in the polymer binding, we just need
    // to sync the value to core
    browserified_exports.core.updateGlobalSettings(browserified_exports.model.globalSettings);
  },
  signalToFireChanged: function() {
    if (browserified_exports.ui.signalToFire != '') {
      this.fire('core-signal', {name: browserified_exports.ui.signalToFire});
      browserified_exports.ui.signalToFire = '';
    }
  },
  /* All functions below help manage paper-toast behaviour. */
  closeToast: function() {
    browserified_exports.ui.toastMessage = null;
  },
  messageNotNull: function(toastMessage :string) {
    // Whether the toast is shown is controlled by if ui.toastMessage
    // is null. This function returns whether ui.toastMessage == null,
    // and also sets a timeout to close the toast.
    if (toastMessage) {
      clearTimeout(this.clearToastTimeout);
      this.clearToastTimeout = setTimeout(this.closeToast, 10000);
      return true;
    }
    return false;
  },
  openTroubleshoot: function() {
    if (this.stringMatches(browserified_exports.ui.toastMessage, user_interface.GET_FAILED_MSG)) {
      this.troubleshootTitle = "Unable to get access";
    } else {
      this.troubleshootTitle = "Unable to share access";
    }
    this.closeToast();
    this.fire('core-signal', {name: 'open-troubleshoot'});
  },
  stringMatches: function(str1 :string, str2 :string) {
    // Determine if the error in the toast is a getter or sharer error
    // by comparing the error string to getter/sharer error constants.
    if (str1) {
      return str1.indexOf(str2) > -1;
    }
    return false;
  },
  topOfStatuses: function(gettingStatus :social.GettingState, sharingStatus :social.SharingState) {
    // Returns number of pixels from the bottom of the window a toast
    // can be positioned without interfering with the getting or sharing
    // status bars.
    // Since the toast always looks for the bottom of the window, not the
    // bottom of its parent element, this function is needed to control toast
    // placement rather than a simpler solution such as moving the toast
    // inside the roster element.
    var padding = 10;
    var statusRowHeight = 58; // From style of the statusRow divs.
    if (gettingStatus && sharingStatus) {
      return 2 * statusRowHeight + padding;
    } else if (gettingStatus || sharingStatus) {
      return statusRowHeight + padding;
    }
    // If there are no status bars, toasts should still 'float' a little
    // above the bottom of the window.
    return padding;
  }
});
