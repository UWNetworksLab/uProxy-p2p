/// <reference path='./context.d.ts' />

Polymer({
  anchor: '',
  openFaq: function() {
    browserified_exports.ui.openTab('generic_ui/faq.html#' + this.anchor);
  },
  ready: function() {}
});
