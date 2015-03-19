Polymer({
  email: '',
  feedback: '',
  logs: '',
  backToSettings: function() {
    ui.view = uProxy.View.SETTINGS;
  },
  sendFeedback: function() {
    // TODO: Get and send real logs.
    core.sendFeedback({
      email: this.email,
      feedback: this.feedback,
      logs: this.$.logCheckbox.checked
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
  viewLogs: function() {
    core.getLogs().then((logs) => {
      var url = 'data:text/html;charset=UTF-8,'
          + encodeURIComponent('<html><h2>Diagnostic Logs</h2><pre>' + logs + '</pre></html>');
      this.ui.openTab(url);
    });
  },
  ready: function() {
    this.ui = ui;
    this.model = model;
  }
});
