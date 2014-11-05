Polymer({

  ready: function() {
    this.path = <InstancePath>{
      network : {
       name: this.network.name,
       userId: this.network.userId
      },
      userId: this.userId,
      instanceId: this.instance.instanceId
    };
    // Expose global ui object and UI module in this context. This allows the
    // hidden? watch for the get/give toggle to actually update.
    this.ui = ui;
    this.UI = UI;
  },

  start: function() {
    console.log('[polymer] calling core.start(', this.path, ')');
    core.start(this.path).then((endpoint) => {
      console.log('[polymer] received core.start promise fulfillment.');
      console.log('[polymer] endpoint: ' + JSON.stringify(endpoint));
      this.ui.startGettingInUiAndConfig(endpoint);
      this.ui.instanceGettingAccessFrom = this.instance.instanceId;
    });
  },
  stop: function() {
    console.log('[polymer] calling core.stop()');
    core.stop();
    this.ui.stopGettingInUiAndConfig(false);
    this.ui.instanceGettingAccessFrom = null;
  },

  // |action| is the string end for a Consent.UserAction
  modifyConsent: function(action :Consent.UserAction) {
    var command = <uProxy.ConsentCommand>{
      path: this.path,
      action: action
    };
    console.log('[polymer] consent command', command)
    core.modifyConsent(command);
  },

  // Proxy UserActions.
  request: function() { this.modifyConsent(Consent.UserAction.REQUEST) },
  cancelRequest: function() {
    this.modifyConsent(Consent.UserAction.CANCEL_REQUEST)
  },
  ignoreOffer: function() { this.modifyConsent(Consent.UserAction.IGNORE_OFFER) },
  unignoreOffer: function() { this.modifyConsent(Consent.UserAction.UNIGNORE_OFFER) },

  // Client UserActions
  offer: function() { this.modifyConsent(Consent.UserAction.OFFER) },
  cancelOffer: function() {
    this.ui.stopGivingInUi();
    this.modifyConsent(Consent.UserAction.CANCEL_OFFER);
  },
  ignoreRequest: function() { this.modifyConsent(Consent.UserAction.IGNORE_REQUEST) },
  unignoreRequest: function() { this.modifyConsent(Consent.UserAction.UNIGNORE_REQUEST) },

  getConsentState: function() : string {
    return this.instance.consent;
  },
});
