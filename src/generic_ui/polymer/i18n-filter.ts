/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import i18n_module = require('../scripts/i18n-filter');
import i18n_t = i18n_module.i18n_t;

 declare var PolymerExpressions: any;
 PolymerExpressions.prototype.$$ = i18n_t;
