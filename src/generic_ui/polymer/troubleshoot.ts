Polymer({
  close: function() {
    this.$.troubleshootDialog.close();
  },
  open: function() {
    this.analyzedNetwork = false;
    this.$.troubleshootDialog.open();
  },
  submitFeedback: function() {
    this.fire('core-signal', {name: 'open-feedback', data: {includeLogs: this.analyzedNetwork}});
    this.close();
  },
  analyzeNetworkAndViewLogs: function() {
    this.ui.openTab('view-logs.html');
    this.analyzedNetwork = true;
  },
  ready: function() {
    this.ui = ui;
    this.model = model;
  }
});
