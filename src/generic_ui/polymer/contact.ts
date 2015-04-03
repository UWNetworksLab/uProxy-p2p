Polymer({
  contact: {
    // Must adhere to the typescript interface UI.User.
    name: 'unknown'
  },
  toggle: function() {
    if (this.model.globalSettings.mode == uProxy.Mode.SHARE) {
      this.contact.shareExpanded = !this.contact.shareExpanded;
    } else if (this.model.globalSettings.mode == uProxy.Mode.GET) {
      this.contact.getExpanded = !this.contact.getExpanded;
    }
  },
  ready: function() {
    this.ui = ui;
    this.uProxy = uProxy;
    this.model = model;
    this.GettingConsentState = UI.GettingConsentState;
    this.SharingConsentState = UI.SharingConsentState;
  },
  openLink: function() {
    this.ui.browserApi.openTab(this.contact.url);
  },

  // |action| is the string end for a uProxy.ConsentUserAction
  modifyConsent: function(action :uProxy.ConsentUserAction) {
    var command = <uProxy.ConsentCommand>{
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
    core.modifyConsent(command);
  },

  // Proxy UserActions.
  request: function() { this.modifyConsent(uProxy.ConsentUserAction.REQUEST) },
  cancelRequest: function() {
    this.modifyConsent(uProxy.ConsentUserAction.CANCEL_REQUEST)
  },
  ignoreOffer: function() { this.modifyConsent(uProxy.ConsentUserAction.IGNORE_OFFER) },
  unignoreOffer: function() { this.modifyConsent(uProxy.ConsentUserAction.UNIGNORE_OFFER) },

  // Client UserActions
  offer: function() { this.modifyConsent(uProxy.ConsentUserAction.OFFER) },
  cancelOffer: function() {
    this.ui.stopGivingInUi();
    this.modifyConsent(uProxy.ConsentUserAction.CANCEL_OFFER);
  },
  ignoreRequest: function() { this.modifyConsent(uProxy.ConsentUserAction.IGNORE_REQUEST) },
  unignoreRequest: function() { this.modifyConsent(uProxy.ConsentUserAction.UNIGNORE_REQUEST) }
});
