
Polymer({
  networks: _.values(model.networks),
  // [
    // 'google',
    // 'facebook'
  // ],
  ready: function() {
    console.log('initializing networks: ', model.networks);
    // this.networks = _.values(model.networks);
  }
});
