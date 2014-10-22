/// <reference path='../../interfaces/ui-polymer.d.ts' />

Polymer({
  // TODO: turn into typescript enums
  network: {},
  LOGGED_OUT: 0,
  LOGGING_IN: 1,
  LOGGED_IN: 2,
  connect: function() {
    if (!this.network) {
      console.error('uproxy-network with no network specified!');
      return;
    }
    console.log('connect fired!');
    this.state = this.LOGGING_IN;
    core.login(this.network.name).then(() => {
      console.log('connected to ' + this.network.name);
      this.state = this.LOGGED_IN;
      ui.view = UI.View.ROSTER;
    });

    // Restore the button after a timeout.
    this.async(() => {
      if (this.LOGGED_IN != this.state) {
        this.state = this.LOGGED_OUT;
      }
    // TODO: Make the timeout the same as LOGIN_TIMEOUT as in core / social.ts,
    // or better yet, figure out a better way to deal with promise rejects in
    // the various cases between failed login or duplicate login attempts.
    }, null, 5000);
  },

  disconnect: function() {
    if (!this.network) {
      console.error('uproxy-network with no network specified!');
      return;
    }
    core.logout(this.network.name);
    console.log('disconnected from ' + this.network.name);
    this.state = this.LOGGED_OUT;
  },

  ready: function() {
    // TODO: Probably turn this into a more reasonable enum to prevent doubling
    // state.
    this.state = this.network.online? this.LOGGED_IN : this.LOGGED_OUT;
  },
});
