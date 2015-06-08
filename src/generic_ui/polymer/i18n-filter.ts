/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

var ui = ui_context.ui;
var i18n_t = ui.i18n_t;

declare var PolymerExpressions: any;
PolymerExpressions.prototype.$$ = i18n_t;
