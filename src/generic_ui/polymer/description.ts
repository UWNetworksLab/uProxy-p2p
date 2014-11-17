/// <reference path='../../interfaces/ui-polymer.d.ts' />
/// <reference path='../../uproxy.ts' />

declare var core :uProxy.CoreAPI;

Polymer({
  description: model.globalSettings.description,
  update: function() {
    model.globalSettings.description = this.description;
    core.updateGlobalSettings({newSettings:model.globalSettings,
                           path:this.path});
  },

  ready: function() {
    this.path = <InstancePath>{
      network : {
       name: this.network.name,
       userId: this.network.userId
      },
      userId: this.userId,
      instanceId: this.instance.instanceId
    };
  }
});
