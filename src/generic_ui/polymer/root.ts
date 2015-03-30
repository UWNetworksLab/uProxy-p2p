/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../scripts/ui.ts' />
/// <reference path='../../uproxy.ts' />

declare var ui :UI.UserInterface;

Polymer({
  model: model,
  dialog: {
    message: '',
    heading: '',
    buttons: []
  },
  updateView: function(e, detail, sender) {
    // If we're switching from the SPLASH page to the ROSTER, fire an
    // event indicating the user has logged in. roster.ts listens for
    // this event.
    if (detail.view == uProxy.View.ROSTER && ui.view == uProxy.View.SPLASH) {
      this.fire('core-signal', {name: "login-success"});
      this.closeSettings();
      this.$.modeTabs.updateBar();
    }
    ui.view = detail.view;
  },
  closeSettings: function() {
    this.$.mainPanel.closeDrawer();
  },
  rosterView: function() {
    console.log('rosterView called');
    ui.view = uProxy.View.ROSTER;
  },
  setGetMode: function() {
    model.globalSettings.mode = uProxy.Mode.GET;
  },
  setShareMode: function() {
    model.globalSettings.mode = uProxy.Mode.SHARE;
  },
  closedWelcome: function() {
    model.globalSettings.hasSeenWelcome = true;
    core.updateGlobalSettings(model.globalSettings);
  },
  closedSharing: function() {
    model.globalSettings.hasSeenSharingEnabledScreen = true;
    core.updateGlobalSettings(model.globalSettings);
  },
  dismissCopyPasteError: function() {
    ui.copyPasteError = UI.CopyPasteError.NONE;
  },
  openDialog: function(e, detail, sender) {
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
    // it's opened. Openly the dialog too early causes it to be positioned
    // incorrectly (i.e. off center).
    this.async(() => {
      this.$.dialog.open();
    });
  },
  dialogButtonClick: function(event, detail, target) {
    var signal = target.getAttribute('data-signal');
    if (signal) {
      this.fire('core-signal', { name: signal });
    }
  },
  ready: function() {
    // Expose global ui object and UI module in this context.
    this.ui = ui;
    this.uProxy = uProxy;
    if(ui.browserApi.browserSpecificElement){
      var browserCustomElement = document.createElement(ui.browserApi.browserSpecificElement);
      this.$.browserElementContainer.appendChild(browserCustomElement);
    }
  },

  observe: {
    'model.globalSettings.mode': 'modeChange'
  },
  modeChange: function() {
    core.updateGlobalSettings(model.globalSettings);
  }
});
