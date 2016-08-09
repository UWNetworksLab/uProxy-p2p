
import translator_module = require('../scripts/translator');

declare var PolymerExpressions: any;

Polymer({
  logs: '',
  loadingLogs: true,
  openLogs: function() {
    // Reset logs and display loading bar
    this.logs = '';
    this.loadingLogs = true;
    ui_context.core.getLogs().then((logs:string) => {
      this.loadingLogs = false;
      // Add browser info to logs.
      this.logs = 'Browser Info: ' + navigator.userAgent + '\n\n' + logs;
    });
    // opens the logsPanel, which contains the logs
    this.$.logsPanel.open();
  },
  close: function() {
    // closes the logsPanel
    this.$.logsPanel.close();
  },
});
