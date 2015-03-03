
Polymer({
  model: model,
  ui: ui,
  backToSettings: function() {
    ui.view = UI.View.SETTINGS;
  },
  sendFeedback: function() {
    console.log(this.email);
    console.log(this.feedback);
    console.log(this.$.logCheckbox.checked);
  },
  ready: function() {}
});
