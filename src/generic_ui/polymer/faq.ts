/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import uproxy_core_api = require('../../interfaces/uproxy_core_api');

Polymer({
  close: function() {
    this.$.faqPanel.close();
  },
  open: function(e :Event, detail :{anchor :string}) {
    // Since opening the FAQ panel is async, set the openingAnchor,
    // and then scrollAfterOpening will scroll to openingAnchor after
    // the panel has finished opening.
    this.openingAnchor = detail.anchor;
    this.$.faqPanel.open();
  },
  scrollAfterOpening: function() {
    var anchorElem = this.$[this.openingAnchor];
    anchorElem.scrollIntoView();
  },
  scroll: function(e :Event) {
    var elemTapped = <HTMLElement>e.target;
    var anchor = elemTapped.getAttribute('data-anchor');
    var anchorElem = this.$[anchor];
    anchorElem.scrollIntoView();
  },
  ready: function() {
    this.openingAnchor = '';
    this.ui = ui_context.ui;
    this.model = ui_context.model;
  }
});
