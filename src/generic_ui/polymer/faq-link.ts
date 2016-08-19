require('polymer');
/// <reference path='./context.d.ts' />

Polymer({
  anchor: '',
  openFaq: function() {
    this.fire('core-signal', {name: 'open-faq', data: {anchor: this.anchor}});
  },
});
