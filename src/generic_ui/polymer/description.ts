/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../../uproxy.ts' />

declare var core :uProxy.CoreAPI;

Polymer({
  description: 'a computer',
  update: () => {
    console.log('updating description to ' + this.description);
    // TODO(keroserene): Actually check that the description update propogates
    // through.
    core.updateDescription(this.description);
  }
});
