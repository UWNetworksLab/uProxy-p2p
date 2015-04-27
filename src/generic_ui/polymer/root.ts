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
    if (detail.view == ui_types.View.ROSTER && ui_context.ui.view == ui_types.View.SPLASH) {
      this.fire('core-signal', {name: "login-success"});
      if (!ui_context.model.globalSettings.hasSeenWelcome) {
        this.statsDialogOrBubbleOpen = true;
        this.$.statsDialog.toggle();
      }
      this.closeSettings();
      this.$.modeTabs.updateBar();
    }
    ui_context.ui.view = detail.view;
  },
  statsIconClicked: function() {
    this.$.mainPanel.openDrawer();
  },
  closeSettings: function() {
    this.$.mainPanel.closeDrawer();
  },
  rosterView: function() {
    console.log('rosterView called');
    ui_context.ui.view = ui_types.View.ROSTER;
  },
  setGetMode: function() {
    ui_context.model.globalSettings.mode = ui_types.Mode.GET;
    ui_context.core.updateGlobalSettings(ui_context.model.globalSettings);
  },
  setShareMode: function() {
    ui_context.model.globalSettings.mode = ui_types.Mode.SHARE;
    ui_context.core.updateGlobalSettings(ui_context.model.globalSettings);
  },
  closedWelcome: function() {
    ui_context.model.globalSettings.hasSeenWelcome = true;
    ui_context.core.updateGlobalSettings(ui_context.model.globalSettings);
  },
  closedSharing: function() {
    ui_context.model.globalSettings.hasSeenSharingEnabledScreen = true;
    ui_context.core.updateGlobalSettings(ui_context.model.globalSettings);
  },
  dismissCopyPasteError: function() {
    ui_context.ui.copyPasteError = ui_types.CopyPasteError.NONE;
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
    this.ui = ui_context.ui;
    this.ui_constants = ui_types;
    this.user_interface = user_interface;
    this.model = ui_context.model;
    this.closeToastTimeout = null;
    if (ui_context.ui.browserApi.browserSpecificElement){
      var browserCustomElement = document.createElement(ui_context.ui.browserApi.browserSpecificElement);
      this.$.browserElementContainer.appendChild(browserCustomElement);
    }
    if (ui_context.ui.view == ui_types.View.ROSTER &&
        !ui_context.model.globalSettings.hasSeenWelcome) {
      this.statsDialogOrBubbleOpen = true;
      this.$.statsDialog.open();
    }
  },
  closeStatsBubble: function() {
    this.statsDialogOrBubbleOpen = false;
  },
  enableStats: function() {
    // TODO: clean up the logic which controls which welcome dialog or bubble
    // is shown.
    this.model.globalSettings.statsReportingEnabled = true;
  },
  disableStats: function() {
    this.model.globalSettings.statsReportingEnabled = false;
    this.statsDialogOrBubbleOpen = false;
  },
  tabSelected: function(e :Event) {
    if (this.ui.isSharingDisabled &&
        this.model.globalSettings.mode == ui_types.Mode.SHARE) {
      // Keep the mode on get and display an error dialog.
      this.model.globalSettings.mode = ui_types.Mode.GET;
      this.fire('open-dialog', {
        heading: 'Sharing Unavailable',
        message: 'Oops! Unfortunately, due to a bug introduced in Firefox 37, sharing from Firefox currently does not work. You can track the issue at bugzil.la/1157766. We hope this will be fixed soon, but in the mean time, the best workaround is to try the uProxy extension for Chrome.',
        buttons: [{text: 'Close', dismissive: true}]
      });
    } else {
      // setting the value is taken care of in the polymer binding, we just need
      // to sync the value to core
      ui_context.core.updateGlobalSettings(ui_context.model.globalSettings);
    }
  },
  signalToFireChanged: function() {
    if (ui_context.ui.signalToFire != '') {
      this.fire('core-signal', {name: ui_context.ui.signalToFire});
      ui_context.ui.signalToFire = '';
    }
  },
  /* All functions below help manage paper-toast behaviour. */
  closeToast: function() {
    ui_context.ui.toastMessage = null;
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
    if (this.stringMatches(ui_context.ui.toastMessage, user_interface.GET_FAILED_MSG)) {
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
  },
  // mainPanel.selected can be either "drawer" or "main"
  // Our "drawer" is the settings panel. When the settings panel is open,
  // make sure to hide the stats tooltip so the two don't overlap.
  drawerToggled: function() {
    if (this.$.mainPanel.selected == 'drawer') {
      // Drawer was opened.
      this.$.statsTooltip.disabled = true;
    } else {
      // Drawer was closed.
      this.$.statsTooltip.disabled = false;
    }
  },
  observe: {
    '$.mainPanel.selected' : 'drawerToggled'
  }
});
