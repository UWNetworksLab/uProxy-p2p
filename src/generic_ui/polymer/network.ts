/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../scripts/core_connector.ts' />
/// <reference path='../scripts/ui.ts' />

declare var ui :UI.UserInterface;
declare var core :CoreConnector;

Polymer({
  connect: function() {
    ui.login(this.networkName).then(() => {
      console.log('connected to ' + this.networkName);
      // Fire an update-view event, which root.ts listens for.
      this.fire('update-view', {view: uProxy.View.ROSTER});
      ui.bringUproxyToFront();
    }).catch((e) => {
      ui.showNotification('There was a problem signing in to ' + this.networkName + '.  Please try again.');
      console.warn('Did not log in ', e);
    });
  },
  ready: function() {},
});
