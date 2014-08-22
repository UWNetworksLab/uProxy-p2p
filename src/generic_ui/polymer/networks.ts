/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../../interfaces/lib/lodash/lodash.d.ts' />

Polymer({
  networks: _.values(model.networks),
  ready: function() {
    console.log('initializing networks: ', model.networks);
  }
});
