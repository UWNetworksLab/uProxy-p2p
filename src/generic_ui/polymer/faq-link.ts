/// <reference path='../../../third_party/typings/index.d.ts'/>
/// <reference path='./context.d.ts' />

Polymer({
  anchor: '',
  openFaq: function() {
    this.fire('core-signal', {name: 'open-faq', data: {anchor: this.anchor}});
  },
});
