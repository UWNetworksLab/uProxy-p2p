/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import copypaste_api = require('../copypaste-api');
declare module browserified_exports {
  var copypaste :copypaste_api.CopypasteApi;
}
import copypaste = browserified_exports.copypaste;

Polymer({
  giveMode: function() {
    copypaste.model.givingOrGetting = 'giving';
  },
  getMode: function() {
    copypaste.model.givingOrGetting = 'getting';
  },
});
