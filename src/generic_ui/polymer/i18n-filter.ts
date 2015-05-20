/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import translator_module = require('../scripts/translator');
import i18n_t = translator_module.i18n_t;

declare var PolymerExpressions: any;
PolymerExpressions.prototype.$$ = i18n_t;
