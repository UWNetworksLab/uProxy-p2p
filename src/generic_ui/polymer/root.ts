/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../scripts/ui.ts' />
/// <reference path='../../uproxy.ts' />

declare var ui :UI.UserInterface;

Polymer({
  model: model,
  updateView: function(e, detail, sender) {
    // If we're switching from the SPLASH page to the ROSTER, fire an
    // event indicating the user has logged in. roster.ts listens for
    // this event.
    if (detail.view == uProxy.View.ROSTER && ui.view == uProxy.View.SPLASH) {
      this.fire('core-signal', {name: "login-success"});
    }
    ui.view = detail.view;
  },
  settingsView: function() {
    ui.view = uProxy.View.SETTINGS;
  },
  rosterView: function() {
    console.log('rosterView called');
    ui.view = uProxy.View.ROSTER;
  },
  setGetMode: function() {
    ui.mode = uProxy.Mode.GET;
  },
  setShareMode: function() {
    ui.mode = uProxy.Mode.SHARE;
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
    ui.copyPasteUrlError = false;
  },
  ready: function() {
    // Expose global ui object and UI module in this context.
    this.ui = ui;
    this.uProxy = uProxy;
    if(ui.browserApi.browserSpecificElement){
      var div = document.createElement("div");
      var browserCustomElement = document.createElement(ui.browserApi.browserSpecificElement);
      div.innerHTML = browserCustomElement.outerHTML;
      this.$.browserElementContainer.appendChild(div.childNodes[0]);
    }
  }
});
