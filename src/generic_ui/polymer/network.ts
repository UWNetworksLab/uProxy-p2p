/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../scripts/core_connector.ts' />
/// <reference path='../scripts/ui.ts' />

declare var ui :UI.UserInterface;
declare var core :uProxy.CoreAPI;

Polymer({
  isLoggingIn: false,
  connect: function() {
    this.isLoggingIn = true;
    core.login(this.networkName).then(() => {
      console.log('connected to ' + this.networkName);
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
