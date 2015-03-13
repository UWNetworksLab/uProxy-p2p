Polymer({
  // Make GettingState enum available to polymer
  GettingState: GettingState,

  ready: function() {
    console.log('in instance ready');
    this.path = <InstancePath>{
      network : {
       name: this.network.name,
       userId: this.network.userId
      },
      userId: this.user.userId,
      instanceId: this.instance.instanceId
    };
    // Expose global ui object and UI module in this context. This allows the
    // hidden? watch for the get/give toggle to actually update.
    this.ui = ui;
    this.uProxy = uProxy;
    this.globalSettings = model.globalSettings;
  },

  start: function() {
    console.log('[polymer] calling core.start(', this.path, ')');
    core.start(this.path).then((endpoint) => {
      console.log('[polymer] received core.start promise fulfillment.');
      console.log('[polymer] endpoint: ' + JSON.stringify(endpoint));
      this.ui.startGettingInUiAndConfig(this.instance.instanceId, endpoint);
    }).catch((e) => {
      ui.browserApi.showNotification('Unable to get access from ' + this.user.name);
      console.error('Unable to start proxying ', e);
    });
  },
  stop: function() {
    console.log('[polymer] calling core.stop()');
    core.stop();
  }
});
