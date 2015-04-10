Polymer({
  close: function() {
    this.$.troubleshootDialog.close();
  },
  open: function() {
    this.analyzedNetwork = false;
    this.$.troubleshootDialog.open();
  },
  submitFeedback: function() {
    this.fire('core-signal', {name: 'open-feedback', data: {includeLogs: this.analyzedNetwork}});
    this.close();
  },
  analyzeNetworkAndViewLogs: function() {
    this.ui.openTab('view-logs.html');
    this.analyzedNetwork = true;
  },
  getNatType: function() {
    this.analyzingNetwork = true;

    core.getNatType().then((natType) => {
      this.natType = natType;
      if (natType === 'SymmetricNAT') {
        this.natDescription = 'very likely';
      } else if (natType === 'PortRestrictedCone') {
        this.natDescription = 'possibly'
      } else {
        this.natDescription = 'unlikely'
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
  }
});
