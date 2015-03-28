Polymer({
  model: model,
  ui: ui,
  email: '',
  feedback: '',
  backToSettings: function() {
    ui.view = uProxy.View.SETTINGS;
  },
  sendFeedback: function() {
    // TODO: update sendFeedback to a promise, and deal
    // with the error case appropriately.
    core.sendFeedback({
      email: this.email,
      feedback: this.feedback,
      logs: this.$.logCheckbox.checked,
      browserInfo: navigator.userAgent
    });
    // Reset the placeholders, which seem to be cleared after the
    // user types input in the input fields.
    this.$.emailInput.placeholder = 'Email address';
    this.$.feedbackInput.placeholder = 'Write your feedback';
    // Clear the form.
    this.email = '';
    this.feedback = '';
    this.$.logCheckbox.checked = false;

    // root.ts listens for open-dialog signals and shows a popup
    // when it receives these events.
    this.fire('open-dialog', {
      heading: 'Thank you!',
      message: 'Your feedback has been submitted to the uProxy development team.',
      buttons: [{
        text: 'Done'
      }]
    });
    ui.view = uProxy.View.ROSTER;
  },
  logsToggled: function() {
    if (this.$.logCheckbox.checked) {
      this.fire('open-dialog', {
        message: 'uProxy will run network diagnostics when you submit your feedback, if you\'ve elected to include logs and network data. If you\'d like to preview your logs and network data, network diagnostics will be run before submission.',
        buttons: [{
          text: 'Got it'
        }, {
          text: 'More info',
          signal: 'more-about-logging',
          dismissive: true
        }]
      });
    }
  },
  moreAboutLogging: function() {
    this.ui.openTab('faq.html#doesUproxyLogData');
  },
  confirmViewLogs: function() {
    this.fire('open-dialog', {
      message: 'uProxy will run network diagnostics when you submit your feedback, if you\'ve elected to include logs and network data. If you\'d like to preview your logs and network data, network diagnostics will be run now. Would you like to preview logs and network data that will be sent to uProxy?',
      buttons: [{
        text: 'Yes',
        signal: 'view-logs'
      }, {
        text: 'No',
        dismissive: true
      }, {
        text: 'More info',
        signal: 'more-about-logging',
        dismissive: true
      }]
    });
  },
  viewLogs: function() {
    this.ui.openTab('view-logs.html');
  },
  ready: function() {
    this.$.logsTooltip.setAttribute('resolved', '');
    this.$.logsTooltip.removeAttribute('unresolved');
  }
});
