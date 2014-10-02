/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../../third_party/typings/lodash/lodash.d.ts' />

Polymer({
  networks: model.networks,
  ready: function() {
    console.log('initializing networks: ', model.networks);
  }
});
