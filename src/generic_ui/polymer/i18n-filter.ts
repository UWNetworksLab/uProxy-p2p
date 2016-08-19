require('polymer');

import translator = require('../scripts/translator');
var i18n_t = translator.i18n_t;

declare var PolymerExpressions: any;
PolymerExpressions.prototype.$$ = i18n_t;
