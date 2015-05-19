/// <reference path='./context.d.ts' />

declare var i18n_t :Function;

Polymer({
  email: '',
  feedback: '',
  logs: '',
  close: function() {
    this.$.feedbackPanel.close();
  },
  open: function(e :Event, detail :{ includeLogs: boolean }) {
    if (detail && detail.includeLogs) {
      this.$.logCheckbox.checked = true;
    }
    this.$.feedbackPanel.open();
  },
  sendFeedback: function() {
    this.$.sendingFeedbackDialog.open();
    ui_context.ui.sendFeedback({
      email: this.email,
      feedback: this.feedback,
      logs: this.$.logCheckbox.checked,
      browserInfo: navigator.userAgent
    }).then(() => {
      // Reset the placeholders, which seem to be cleared after the
      // user types input in the input fields.
      this.$.emailInput.placeholder = i18n_t('emailPlaceholder');
      this.$.feedbackInput.placeholder = i18n_t('feedbackPlaceholder');
      // Clear the form.
      this.email = '';
      this.feedback = '';
      this.$.logCheckbox.checked = false;

      // root.ts listens for open-dialog signals and shows a popup
      // when it receives these events.
      this.fire('open-dialog', {
        heading: i18n_t('thankYou'),
        message: i18n_t('feedbackSubmitted'),
        buttons: [{
          text: i18n_t('done'),
          signal: 'close-settings'
        }]
      });
      this.close();
      this.$.sendingFeedbackDialog.close();
    }).catch((e :Error) => {
      this.fire('open-dialog', {
        heading: i18n_t('emailInsteadTitle'),
        message: i18n_t('emailInsteadMessage'),
        buttons: [{
          text: i18n_t('ok')
        }]
      });
      this.$.sendingFeedbackDialog.close();
    });
  },
  viewLogs: function() {
    this.ui.openTab('generic_ui/view-logs.html');
  },
  ready: function() {
    this.ui = ui_context.ui;
    this.model = ui_context.model;
  },
  computed: {
    'opened': '$.feedbackPanel.opened'
  },
});
