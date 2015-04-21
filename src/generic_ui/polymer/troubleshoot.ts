Polymer({
  analyzingNetwork: false,
  analyzedNetwork: false,
  natType: '',
  natImpact: '',
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
    browserified_exports.core.getNatType().then((natType :string) => {
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
  }
});
