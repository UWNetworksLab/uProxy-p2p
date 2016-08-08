/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import translator = require('../scripts/translator');
var i18n_t = translator.i18n_t;

declare var PolymerExpressions: any;
PolymerExpressions.prototype.$$ = (placeholder :string, language :string, params?: any) :string => {
  return i18n_t(placeholder, params);
}
