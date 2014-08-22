Polymer({
  // TODO: turn into typescript enums
  LOGGED_OUT: 0,
  LOGGING_IN: 1,
  LOGGED_IN: 2,
  connect: function() {
    if (!this.network) {
      console.error('uproxy-network with no network specified!');
      return;
    }
    console.log('connect fired!');
    // var ui = this.parentNode.host.parentNode.host;
    // console.log(ui);
    this.state = this.LOGGING_IN;
    core.login(this.network.name).then(function() {
      console.log('connected to ' + this.network.name);
      this.state = this.LOGGED_IN;
    }.bind(this))
    // .catch(function() {
      // console.log('failed to connect to ' + this.network.name);
      // this.state = this.LOGGED_OUT;
    // }.bind(this));
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
