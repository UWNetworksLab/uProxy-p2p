Polymer({
  ready: function() {
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
    this.GettingState = GettingState;
    this.model = model;
  },
  start: function() {
    console.log('[polymer] calling core.start(', this.path, ')');
    core.start(this.path).then((endpoint) => {
      console.log('[polymer] received core.start promise fulfillment.');
      console.log('[polymer] endpoint: ' + JSON.stringify(endpoint));
      this.ui.startGettingInUiAndConfig(this.instance.instanceId, endpoint);
    }).catch((e) => {
      this.fire('core-signal', {name: 'open-troubleshoot'});
      ui.bringUproxyToFront();
      console.error('Unable to start proxying ', e);
    });
  },
  stop: function() {
    console.log('[polymer] calling core.stop()');
    core.stop();
  }
});
