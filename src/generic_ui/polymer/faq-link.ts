/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='./context.d.ts' />

Polymer({
  anchor: '',
  openFaq: function() {
    this.ui.openTab('generic_ui/faq.html#' + this.anchor);
  },
  ready: function() {
    this.ui = browserified_exports.ui;
  }
});
