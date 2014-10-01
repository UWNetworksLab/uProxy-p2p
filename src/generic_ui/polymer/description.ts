/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../../uproxy.ts' />

declare var core :uProxy.CoreAPI;

Polymer({
  description: 'My Computer',
  update: function() {
    core.updateDescription(this.description);
  }
});
