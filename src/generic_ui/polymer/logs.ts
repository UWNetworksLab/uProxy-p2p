/// <reference path='../scripts/ui.ts' />
declare var ui :UI.UserInterface;

Polymer({
  logs: '',
  loadingLogs: true,
  getNetworkInfo: function() {
  },
  ready: function() {
    // Expose global ui object in this context.
    this.ui = ui;
    core.getLogs().then((logs) => {
      this.loadingLogs = false;
      this.logs = logs;
    });
  }
});
