/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='./context.d.ts' />

Polymer({
  anchor: '',
  openFaq: function() {
    ui_context.ui.openTab('generic_ui/faq.html#' + this.anchor);
  },
  ready: function() {}
});
