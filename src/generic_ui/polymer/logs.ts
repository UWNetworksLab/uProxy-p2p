
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
  ready: function() {
    // Expose global ui object in this context.

    let fulfillGetLogs: Function;
    let rejectGetLogs: Function;
    const getLogs = new Promise<string>((F, R) => {
      fulfillGetLogs = F;
      rejectGetLogs = R;
    });

    if (window.chrome) {
      chrome.runtime.sendMessage(extensionId, {
        getLogs: true
      }, (reply) => {
        if (reply) {
          fulfillGetLogs(reply.logs);
        } else {
          rejectGetLogs('Could not get logs');
        }
      });
    } else {
      window.postMessage({
        getLogs: true,
        data: false
      }, '*');
      // TODO: reject after a timeout
      window.addEventListener('message', (event) => {
        if (event.data.logs) {
          fulfillGetLogs(event.data.logs);
        }
      }, false);
    }

    getLogs.then((logs) => {
      this.loadingLogs = false;
      this.logs = 'Browser Info: ' + navigator.userAgent + '\n\n' + logs;
    });
  }
});
