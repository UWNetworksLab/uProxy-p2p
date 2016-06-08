/// <reference path='../../../../../third_party/polymer/polymer.d.ts' />

import copypaste_api = require('../copypaste-api');
declare module browserified_exports {
  var copypaste :copypaste_api.CopypasteApi;
}
import copypaste = browserified_exports.copypaste;

import I18nUtil = require('../i18n-util.types');
declare var i18nUtil :I18nUtil;

Polymer({
  model: copypaste.model,
  generateIceCandidates: function() {
    this.$.generateIceCandidatesButton.disabled = true;
    copypaste.onceReady.then((copypasteModule) => { copypasteModule.emit('start', {}); });
  },
  parseInboundText: function() {
    if (copypaste.model.usingCrypto && !copypaste.model.inputDecrypted) {
      copypaste.verifyDecryptInboundMessage(copypaste.model.inboundText);
    } else {
      copypaste.parseInboundMessages();
    }
  },
  consumeInboundText: function() {
    copypaste.consumeInboundMessage();
    // Disable the form field, since it no longer makes sense to accept further
    // input in it.
    this.$.inboundMessageNode.disabled = true;
    // Disable the "Start Proxying" button after it's clicked.
    this.$.consumeMessageButton.disabled = true;
  },
  ready: function() {
    i18nUtil.translateStrings(this);
  }
});
