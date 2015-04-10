Polymer({
  aborted: false, // did the user manually cancel the last connection
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
    this.fire('set-instance-trying-to-get', {isInstanceTryingToGet: true});
    if (!this.instance.isOnline) {
      this.fire('core-signal', {
        name: 'show-toast',
        data: {
          text: this.user.name + ' is offline'
        }
      });
      return;
    }

    console.log('[polymer] calling core.start(', this.path, ')');

    this.aborted = false;
    core.start(this.path).then((endpoint) => {
      console.log('[polymer] received core.start promise fulfillment.');
      console.log('[polymer] endpoint: ' + JSON.stringify(endpoint));
      this.ui.startGettingInUiAndConfig(this.instance.instanceId, endpoint);
      this.fire('set-instance-trying-to-get', {isInstanceTryingToGet: false});
    }).catch((e) => {
      if (this.aborted) {
        // if the failure is because of a user action, do nothing
        return;
      }

      this.fire('core-signal', {name: 'open-troubleshoot'});
      ui.bringUproxyToFront();
      console.error('Unable to start proxying ', e);
      this.fire('set-instance-trying-to-get', {isInstanceTryingToGet: false});
    });
  },
  stop: function() {
    this.fire('set-instance-trying-to-get', {isInstanceTryingToGet: false});
    this.aborted = true;
    console.log('[polymer] calling core.stop()');
    core.stop();
  }
});
