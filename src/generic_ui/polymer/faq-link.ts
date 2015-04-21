/// <reference path='./context.d.ts' />

Polymer({
  anchor: '',
  openFaq: function() {
    this.ui.openTab('faq.html#' + this.anchor);
  },
  ready: function() {
    this.ui = browserified_exports.ui;
  }
});
