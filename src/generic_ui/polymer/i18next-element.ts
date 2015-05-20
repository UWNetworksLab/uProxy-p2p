/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../../../../third_party/typings/i18next/i18next.d.ts' />

import i18n = require('i18next');

Polymer({
  $$: function() {
    var i18n_t = i18n.t;
    return i18n_t.apply(window, arguments);
  },
  changeLanguage: function(lng :string) {
    i18n.setLng(lng);
    // TODO: trigger refresh for text to update.
  }
});
