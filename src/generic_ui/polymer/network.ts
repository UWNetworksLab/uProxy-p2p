/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../scripts/core_connector.ts' />
/// <reference path='../scripts/ui.ts' />

declare var ui :UI.UserInterface;
declare var core :CoreConnector;

Polymer({
  connect: function() {
    core.login(this.networkName).then(() => {
      console.log('connected to ' + this.networkName);
      // Fire an update-view event, which root.ts listens for.
      this.fire('update-view', {view: UI.View.ROSTER});
      ui.bringUproxyToFront();
    }).catch((e) => {
      console.warn('Did not log in ', e);
    });
  },
  ready: function() {},
});
