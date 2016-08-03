/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import translator = require('../scripts/translator');

declare var PolymerExpressions: any;
PolymerExpressions.prototype.$$ = (placeholder :string, language :string, params?: any) :string => {
  return translator.i18n_t(placeholder, params);
}
