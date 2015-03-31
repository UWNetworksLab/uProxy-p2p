Polymer({
  close: function() {
    this.$.troubleshootDialog.close();
  },
  open: function() {
    this.$.troubleshootDialog.open();
  },
  sendNetworkInfo: function() {
    core.sendFeedback({
      email: '',
      feedback: '',
      logs: false,
      browserInfo: '',
      networkInfo: true
    }).then(() => {
      this.close();
      // root.ts listens for open-dialog signals and shows a popup
      // when it receives these events.
      this.fire('open-dialog', {
        heading: 'Thank you!',
        message: 'Your NAT type has been submitted to the uProxy development team.',
        buttons: [{
          text: 'Done',
          signal: 'close-settings'
        }]
      });
    }).catch((e) => {
      this.close();
      this.fire('open-dialog', {
        heading: 'Email instead?',
        message:
          'Oops! We were unable to submit your NAT type to uproxy.org. Please send your NAT type ('
          + this.natType
          + ') in an email to info@uproxy.org.',
        buttons: [{
          text: 'OK'
        }]
      });
    });
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
