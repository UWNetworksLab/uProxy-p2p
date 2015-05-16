/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../../../../third_party/typings/i18next/i18next.d.ts' />

import i18n = require('i18next');
//import i18n = I18Next.i18n;

interface I18nWindow extends Window { i18nResources: any; }

declare var window: I18nWindow;
declare var PolymerExpressions: any;

window.i18nResources = {};

i18n.init({
  resStore: window.i18nResources
});

function addI18nResources(resStore :IResourceStore) {
  Polymer.mixin(window.i18nResources, resStore);
};

var i18n_t = i18n.t;

addI18nResources({
  'en-US': {
    translation: {
      'Good': 'Bueno',
      'Bad': 'Malo',
      'Hello': 'Hello __name__'
    }
  }
});

addI18nResources({
  'fr': {
    translation: {
      'Good': 'Bien',
      'Bad': 'Mal',
      'Hello': 'Bonjour __name__'
    }
  }
});


i18n.addResourceBundle('en-US', 'translation', {
  'Squid': '__count__ Squid',
  'Squid_plural': '__count__ Squids'
});

PolymerExpressions.prototype.$$ = i18n_t;

Polymer({
  $$: function() {
    return i18n_t.apply(window, arguments);
  }
});
