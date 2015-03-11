Polymer({
  model: model,
  ui: ui,
  email: '',
  feedback: '',
  logs: '',
  backToSettings: function() {
    ui.view = uProxy.View.SETTINGS;
  },
  sendFeedback: function() {
    // TODO: Get and send real logs.
    if (this.$.logCheckbox.checked) {
      this.logs = 'placeholder';
    } else {
      this.logs = 'none'
    }
    core.sendFeedback({
      email: this.email,
      feedback: this.feedback,
      logs: this.logs
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
    this.fire('open-dialog',
      { dialog:
        { heading: 'Thank you!',
          message: 'Your feedback has been submitted to the uProxy development team.',
          affirmative: {
            text: 'Done',
            signal: ''
          },
          dismissive: {
            text: '',
            signal: ''
          }
        }
      });
    ui.view = uProxy.View.ROSTER;
  },
  viewLogs: function() {
    core.getLogs().then((logs) => {
      this.logs = '';
      for (var i = 0; i < logs.length; i++) {
        this.logs += logs[i] + '\n';
      }
      var url = 'data:text/html;charset=UTF-8,'
          + encodeURIComponent('<html><h2>Diagnostic Logs</h2><pre>' + this.logs + '</pre></html>');
      this.ui.openTab(url);
    });
  },
  ready: function() {}
});
