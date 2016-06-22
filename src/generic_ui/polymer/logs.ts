
import translator_module = require('../scripts/translator');

declare var PolymerExpressions: any;
PolymerExpressions.prototype.$$ = translator_module.i18n_t;

const extensionId = 'pjpcdnccaekokkkeheolmpkfifcbibnj';

Polymer({
  logs: '',
  loadingLogs: true,
  openUproxy: function() {
    if (window.chrome) {
      chrome.runtime.sendMessage(extensionId, {
        openWindow: true
      });
    } else {
      window.postMessage({
        showPanel: true,
        data: false
      }, '*');
    }
  },
  created: function() {
    // Default language to English.
    var language = window.location.href.split('lang=')[1] || 'en';
    translator_module.i18n_setLng(language.substring(0, 2));
  },
  openLogs: function() {
    this.$.hitesting.open();
  },
  ready: function() {
    const handleLogs = (logs: string) => {
      if (logs) {
        this.loadingLogs = false;
        this.logs = 'Browser Info: ' + navigator.userAgent + '\n\n' + logs;
      } else {
        console.error('could not get logs');
      }
    };

    if (window.chrome) {
      chrome.runtime.sendMessage(extensionId, {
        getLogs: true
      }, (reply) => {
        handleLogs(reply.logs);
      });
    } else {
      window.postMessage({
        getLogs: true,
        data: false
      }, '*');
      window.addEventListener('message', (event) => {
        handleLogs(event.data.logs);
      }, false);
    }
  }
});
