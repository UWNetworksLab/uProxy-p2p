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
    getLogs().then((logs) => {
      this.loadingLogs = false;
      // Add browser info to logs.
      this.logs = 'Browser Info: ' + navigator.userAgent + '\n\n' + logs;
    });
  }
});
