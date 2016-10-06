/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import * as copypaste_api from '../copypaste-api';
declare module browserified_exports {
  var copypaste :copypaste_api.CopypasteApi;
}
import copypaste = browserified_exports.copypaste;

import I18nUtil from '../i18n-util.types';
declare var i18nUtil :I18nUtil;

Polymer({
  model: copypaste.model,
  updateLanguage: function() {
    var selectedLanguage = this.$.languageInput
        .options[this.$.languageInput.selectedIndex].value;
    i18nUtil.changeLanguage(selectedLanguage);
  },
  ready: function() {
    // The application starts up without a set language.
    // Default to setting the language to the browser's language.
    i18nUtil.changeLanguage(i18nUtil.getBrowserLanguage());
  },
  useCrypto: function() {
    copypaste.model.usingCrypto = true;
  },
});
