Polymer({
  contact: {
    // Must adhere to the typescript interface UI.User.
    name: 'unknown',
    pic: undefined,
    expanded: false
  },
  toggle: function() {
    this.contact.expanded = !this.contact.expanded;
  },
  collapse: function() {
    this.contact.expanded = false;
    console.log('collapse', this.contact.expanded);
  },
  ready: function() {
    this.ui = ui;
    this.uProxy = uProxy;
    this.globalSettings = model.globalSettings;
    this.GettingConsentState = UI.GettingConsentState;
    this.SharingConsentState = UI.SharingConsentState;
    if (!this.contact.pic) {
      this.contact.pic = '../icons/contact-default.png';
    }
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
