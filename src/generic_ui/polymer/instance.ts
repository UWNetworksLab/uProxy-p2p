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
      // TODO: the querySelector should be replaced with the line below, which
      // for some reason does not work. GitHub issue:
      // https://github.com/uProxy/uproxy/issues/1199
      // this.fire('core-signal', {name: 'open-troubleshoot'});
      document.querySelector('html /deep/ #troubleshootDialog').open();
      ui.bringUproxyToFront();
      console.error('Unable to start proxying ', e);
    });
  },
  stop: function() {
    console.log('[polymer] calling core.stop()');
    core.stop();
  }
});
