Polymer({
  getting: function() {
    // return UI.Gestalt.GETTING == window['$ui'].gestalt;
    return true;
    // var roster = this.parentNode.host;
    // console.log(roster);
    // if (!roster) {
      // return false;
    // }
    // var ui = roster.parentNode.host;
    // return ui.GETTING == ui.gestalt;
  },
  start: function() {
    var path = <InstancePath>{
      network: 'google',  // TODO: Make network reflect actual social network.
      userId: this.userId,
      instanceId: this.instance.instanceId
    };
    console.log('[polymer] calling core.start(', path, ')');
    // this.access.asProxy = true;
    core.start(path).then(() => {
      console.log('[polymer] received core.start promise fulfillment.');
      // TODO: Use BrowserAction to set the extension icon to 'proxy mode'.
    });
  },
  stop: function() {
    console.log('[polymer] calling core.stop()');
    // this.access.asProxy = false;
    core.stop();
  }
});
