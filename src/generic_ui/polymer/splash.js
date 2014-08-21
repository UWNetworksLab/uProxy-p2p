Polymer({
  currentView: 0,
  next: function() {
    console.log('whoaa');
    this.currentView++;
  },
  ready: function() {
    console.log('splash is ready');
  }
});
