/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import uproxy_core_api = require('../../interfaces/uproxy_core_api');

Polymer({
  close: function() {
    this.$.faqPanel.close();
  },
  open: function() {
    this.$.faqPanel.open();
  },
  ready: function() {
    this.ui = ui_context.ui;
    this.model = ui_context.model;
  }
});

console.log("0");

window.onload = function() {
  var backToTop = document.getElementsByClassName("top");
  console.log("1");
  console.log(backToTop);
  for (var i = 0, j = backToTop.length; i < j; i++) {
    console.log("2");

    backToTop[i].addEventListener("click", function() {
      window.scroll(0, 0);
    });
    console.log("3");

  }
};