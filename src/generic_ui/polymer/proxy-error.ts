/// <reference path='./context.d.ts' />
require('polymer');

Polymer({
  error: false,
  openWithError: function() {
    this.wasError = true;
    this.open();
  },
  open: function() {
    this.$.dialog.open();
  },
  close: function() {
    this.wasError = false;
    this.$.dialog.close();
  },
});
