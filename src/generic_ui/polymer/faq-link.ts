Polymer({
  anchor: '',
  openFaq: function() {
    this.ui.openTab('faq.html#' + this.anchor);
  },
  ready: function() {
    this.ui = ui;
  }
});
