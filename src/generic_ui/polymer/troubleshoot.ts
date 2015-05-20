declare var i18n_t :Function;

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
    ui_context.core.getNatType().then((natType :string) => {
      this.natType = natType;
      if (natType === 'SymmetricNAT') {
        this.natImpact = i18n_t('veryLikely');
      } else if (natType === 'PortRestrictedCone') {
        this.natImpact = i18n_t('possibly');
      } else {
        this.natImpact = i18n_t('unlikely');
      }
      this.analyzingNetwork = false;
      this.analyzedNetwork = true;
    });
  }
});
