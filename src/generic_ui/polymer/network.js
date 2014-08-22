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
    var ui = this.parentNode.host.parentNode.host;
    console.log(ui);
    this.state = this.LOGGING_IN;
    this.async(function() {
       // TODO: Call upon actual login here.
      console.log('connected to ' + this.network);
      this.state = this.LOGGED_IN;
      ui.loggedIn = true;
    }, null, 1000);
  },
  disconnect: function() {
    if (!this.network) {
      console.error('uproxy-network with no network specified!');
      return;
    }
    console.log('disconnect fired!');
    this.state = this.LOGGED_OUT;
  },
  ready: function() {
    this.state = this.LOGGED_OUT;
  },
});
