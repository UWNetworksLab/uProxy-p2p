Polymer({
  // Injected configuration
  msg: null,
  // Public methods
  onBack: function(handler) {
    this.addEventListener('back', handler);
  },
  onDone: function(handler) {
    this.addEventListener('done', handler);
  },
  onMetricsChoiceMade: function(handler) {
    this.addEventListener('metrics-choice-made', (event) => { handler(event.detail); });
  },
  // Private methods
  handleBack_: function() {
    this.fire('back');
  },
  handleOptIn_: function() {
    this.fireMetricsChoiceMade_(true);
    this.fireDone_();
  },
  handleOptOut_: function() {
    this.fireMetricsChoiceMade_(false);
    this.fireDone_();
  },
  fireBack_: function() {
    this.fire('back');
  },
  fireMetricsChoiceMade_: function(optIn) {
    this.fire('metrics-choice-made', optIn);
  },
  fireDone_: function() {
    this.fire('done');
  }
});