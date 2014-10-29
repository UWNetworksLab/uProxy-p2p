/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../../uproxy.ts' />

declare var core :uProxy.CoreAPI;

Polymer({
  description: model.description,
  update: function() {
    core.updateDescription(this.description);
  }
});
