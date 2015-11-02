/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import uproxy_core_api = require('../../interfaces/uproxy_core_api');

interface AnchorElement extends Element {
  scrollIntoView(top? :boolean) :void;
}

Polymer({
  close: function() {
    this.$.faqPanel.close();
  },
  open: function(e :Event, detail :{anchor :string}) {
    this.$.faqPanel.open();
    this.anchor = detail.anchor;
  },
  scroll: function(e :Event) {
    var anchor = this.anchor;
    var elemTapped :HTMLElement = <HTMLElement>e.target;
    if (elemTapped && elemTapped.getAttribute('data-anchor')) {
      anchor = elemTapped.getAttribute('data-anchor');
    }
    var anchorElem :AnchorElement = <AnchorElement>document.querySelector("html /deep/ #" + anchor);
    anchorElem.scrollIntoView();
  },
  ready: function() {
    this.anchor = '';
    this.ui = ui_context.ui;
    this.model = ui_context.model;
  }
});
