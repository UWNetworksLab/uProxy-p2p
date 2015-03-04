
Polymer({
  model: model,
  ui: ui,
  email: '',
  feedback: '',
  logs: '',
  backToSettings: function() {
    ui.view = UI.View.SETTINGS;
  },
  sendFeedback: function() {
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
  },
  ready: function() {}
});
