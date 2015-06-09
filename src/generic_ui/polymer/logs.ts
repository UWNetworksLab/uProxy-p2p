
import translator_module = require('../scripts/translator');

declare var PolymerExpressions: any;
PolymerExpressions.prototype.$$ = translator_module.i18n_t;

declare var bringUproxyToFront :() => void;
declare var getLogs :() => Promise<string>;

Polymer({
  logs: '',
  loadingLogs: true,
  openUproxy: function() {
    // TODO: add a pop-out icon that calls this function.
    bringUproxyToFront();
  },
  created: function() {
    // Default language to English.
    var language = window.location.href.split('lang=')[1] || 'en';
    translator_module.i18n_setLng(language.substring(0,2));
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
