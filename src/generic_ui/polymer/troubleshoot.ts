Polymer({
  close: function() {
    this.$.troubleshootDialog.close();
  },
  open: function() {
    this.analyzedNetwork = false;
    this.analyzingNetwork = false;
    this.$.troubleshootDialog.open();
  },
  submitFeedback: function() {
    this.fire('core-signal', {name: 'open-feedback', data: {includeLogs: this.analyzedNetwork}});
    this.close();
  },
  getNatType: function() {
    this.analyzingNetwork = true;
    core.getNatType().then((natType) => {
      this.natType = natType;
      if (natType === 'SymmetricNAT') {
        this.natImpact = 'very likely';
      } else if (natType === 'PortRestrictedCone') {
        this.natImpact = 'possibly'
      } else {
        this.natImpact = 'unlikely'
      }
      this.analyzingNetwork = false;
      this.analyzedNetwork = true;
    });
  },
  ready: function() {
    this.ui = ui;
    this.model = model;
    this.analyzingNetwork = false;
    this.analyzedNetwork = false;
    this.natType = '';
    this.natImpact = '';
  }
});
