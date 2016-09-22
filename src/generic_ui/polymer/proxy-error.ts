/// <reference path='./context.d.ts' />
/// <reference path='../../../third_party/polymer/polymer.d.ts' />

Polymer('uproxy-proxy-error', {
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
