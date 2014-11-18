/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../scripts/core_connector.ts' />
/// <reference path='../scripts/ui.ts' />

declare var ui :UI.UserInterface;
declare var core :uProxy.CoreAPI;

Polymer({
  // TODO: turn into typescript enums
  isLoggingIn: false,
  network: {},
  connect: function() {
    if (!this.network) {
      console.error('uproxy-network with no network specified!');
      return;
    }
    console.log('connect fired!');
    this.isLoggingIn = true;
    core.login(this.network.name).then(() => {
      console.log('connected to ' + this.network.name);
      this.isLoggingIn = false;
      ui.view = UI.View.ROSTER;
    });

    // Restore the button after a timeout.
    this.async(() => {
      if (this.LOGGED_IN != this.state) {
        this.isLoggingIn = false;
      }
    // TODO: Make the timeout the same as LOGIN_TIMEOUT as in core / social.ts,
    // or better yet, figure out a better way to deal with promise rejects in
    // the various cases between failed login or duplicate login attempts.
    }, null, 5000);
  },
  ready: function() {},
});
