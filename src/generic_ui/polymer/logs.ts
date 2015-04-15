declare var getLogs :Function;
declare var bringUproxyToFront :Function;

Polymer({
  logs: '',
  loadingLogs: true,
  openUproxy: function() {
    bringUproxyToFront();
  },
  ready: function() {
    // Expose global ui object in this context.
    getLogs();
  }
});
