Polymer({
  model: model,
  ui: ui,
  email: '',
  feedback: '',
  logs: '',
  backToSettings: function() {
    ui.view = UI.View.SETTINGS;
  },
  backToRoster: function() {
    ui.view = UI.View.ROSTER;
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
    this.$.confirmation.toggle();
    // Reset the placeholders, which seem to be cleared after the
    // user types input in the input fields.
    this.$.emailInput.placeholder = 'Email address';
    this.$.feedbackInput.placeholder = 'Write your feedback';
    // Clear the form.
    this.email = '';
    this.feedback = '';
    this.$.logCheckbox.checked = false;
  },
  viewLogs: function() {
    var url = 'data:text/html;charset=UTF-8,'
        + encodeURIComponent('<html><h2>Diagnostic Logs</h2><pre>' + this.logs + '</pre></html>');
    this.ui.openTab(url);
  },
  ready: function() {}
});
