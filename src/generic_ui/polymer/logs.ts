import translator_module = require('../scripts/translator');

declare var bringUproxyToFront :() => void;
declare var getLogs :() => Promise<string>;

Polymer({
  logs: '',
  loadingLogs: true,
  language: 'en',
  $$: function(lang :string, placeholder :string) {
    return translator_module.i18n_t(placeholder);
  },
  openUproxy: function() {
    // TODO: add a pop-out icon that calls this function.
    bringUproxyToFront();
  },
  created: function() {
    // Default language to English.
    this.language = window.location.href.split('lang=')[1];
    translator_module.i18n_setLng(this.language.substring(0,2));
  },
  ready: function() {
    // Expose global ui object in this context.
    getLogs().then((logs :string) => {
      this.loadingLogs = false;
      // Add browser info to logs.
      this.logs = 'Browser Info: ' + navigator.userAgent + '\n\n' + logs;
    });
  }
});
