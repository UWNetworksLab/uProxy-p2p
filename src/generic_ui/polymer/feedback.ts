/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import uproxy_core_api = require('../../interfaces/uproxy_core_api');

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

Polymer({
  email: '',
  feedback: '',
  logs: '',
  feedbackType: '',
  close: function() {
    this.$.feedbackPanel.close();
  },
  open: function(e:Event, data?:{
    includeLogs: boolean;
    feedbackType: uproxy_core_api.UserFeedbackType;
   }) {
    if (data && data.includeLogs) {
      this.$.logCheckbox.checked = true;
    }
    this.feedbackType = (data && data.feedbackType) ? data.feedbackType :
        uproxy_core_api.UserFeedbackType.USER_INITIATED;
    this.$.feedbackPanel.open();
  },
  sendFeedback: function() {
    this.feedback = this.feedback.trim();
    this.$.feedbackDecorator.isInvalid = !this.feedback.length;

    if (this.$.feedbackDecorator.isInvalid) {
      return;
    }

    this.$.sendingFeedbackDialog.open();
    ui_context.ui.sendFeedback({
      email: this.email,
      feedback: this.feedback,
      logs: this.$.logCheckbox.checked,
      browserInfo: navigator.userAgent,
      feedbackType: this.feedbackType
    }).then(() => {
      // Reset the placeholders, which seem to be cleared after the
      // user types input in the input fields.
      this.$.emailInput.placeholder = ui.i18n_t('EMAIL_PLACEHOLDER');
      this.$.feedbackInput.placeholder = ui.i18n_t('FEEDBACK_PLACEHOLDER');
      // Clear the form.
      this.email = '';
      this.feedback = '';
      this.$.logCheckbox.checked = false;
      // root.ts listens for open-dialog signals and shows a popup
      // when it receives these events.
      ui.showDialog(ui.i18n_t('THANK_YOU'), ui.i18n_t('FEEDBACK_SUBMITTED'),
          ui.i18n_t('DONE'), 'close-settings');
      this.close();
      this.$.sendingFeedbackDialog.close();
    }).catch((e :Error) => {
      ui.showDialog(
          ui.i18n_t('EMAIL_INSTEAD_TITLE'), ui.i18n_t('EMAIL_INSTEAD_MESSAGE'));
      this.$.sendingFeedbackDialog.close();
    });
  },
  viewLogs: function() {
    //this.ui.openTab('generic_ui/view-logs.html?lang=' + model.globalSettings.language);
    //this.$.feedbackPanel.close();
    //this.$.feedbackPanel.close();
    this.fire('core-signal', { name: 'open-logs' });
  },
  ready: function() {
    this.ui = ui_context.ui;
    this.model = ui_context.model;
  },
  computed: {
    'opened': '$.feedbackPanel.opened'
  },
});
