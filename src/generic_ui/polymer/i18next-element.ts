/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../../../../third_party/typings/i18next/i18next.d.ts' />

declare var i18n: I18nextStatic;

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
