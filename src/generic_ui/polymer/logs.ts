
import translator_module = require('../scripts/translator');

declare var PolymerExpressions: any;
PolymerExpressions.prototype.$$ = translator_module.i18n_t;

Polymer({
  logs: '',
  loadingLogs: true,
  created: function() {
    // Default language to English.
    var language = window.location.href.split('lang=')[1] || 'en';
    translator_module.i18n_setLng(language.substring(0, 2));
  },
  openLogs: function() {
    // opens the logsPanel, which contains the logs
    this.$.logsPanel.open();
  },
  close: function() {
    // closes the logsPanel
    this.$.logsPanel.close();
  },
  ready: function() {
    // TODO: Move this update out of "ready", to fix #2541.
    ui_context.core.getLogs().then((logs:string) => {
      this.loadingLogs = false;
      // Add browser info to logs.
      this.logs = 'Browser Info: ' + navigator.userAgent + '\n\n' + logs;
    });
  }
});
