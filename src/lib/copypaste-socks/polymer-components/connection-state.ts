require('polymer');

import copypaste_api = require('../copypaste-api');
declare module browserified_exports {
  var copypaste :copypaste_api.CopypasteApi;
}
import copypaste = browserified_exports.copypaste;

Polymer({
  model: copypaste.model,
  stopProxying: function() {
    copypaste.onceReady.then((copypasteModule) => {
      copypasteModule.emit('stop', {});
    });
  }
});
