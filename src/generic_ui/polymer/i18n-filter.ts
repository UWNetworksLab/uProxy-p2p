/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import translator_module = require('../scripts/translator');

var i18n_t = translator_module.i18n_t;
var i18n_setLng = translator_module.i18n_setLng;

declare var PolymerExpressions: any;
PolymerExpressions.prototype.$$ = i18n_t;
