var { Cc, Ci, Cr } = require('chrome');

exports.setup = function(panel, button) {
  var observer = {
    observe: function (subject, topic, data) {
      if ('http-on-modify-request' !== topic) {
        return;
      }

      subject.QueryInterface(Ci.nsIHttpChannel);
      var url = subject.URI.spec

      if (!/https:\/\/www.uproxy.org\/(request|offer)\/(.*)/.test(url)) {
        return;
      }

      panel.port.emit('urlData', url);
      panel.show({
        position: button
      });

      subject.cancel(Cr.NS_BINDING_ABORTED);
    }
  };

  var service = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
  service.addObserver(observer, 'http-on-modify-request', false);
};
