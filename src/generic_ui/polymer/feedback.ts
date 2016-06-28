/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import translator = require('../scripts/translator');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');
import dialogs = require('../scripts/dialogs');

var ui = ui_context.ui;
var core = ui_context.core;
var model = ui_context.model;

Polymer({
  email: '',
  error: '',
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
    this.$.feedbackPanel.open();
  },
  sendFeedback: function() {
    this.feedback = this.feedback.trim();
    //if user does not select something from dropdown
    if (this.$.errorInput.selected == 'null') {
        this.$.errorDecorator.isInvalid = true;
        return;
    }

    //if user selects 'other', make sure that additional feedback is required
    if (this.$.errorInput.selected == 6 && !this.feedback.length) {
      this.$.errorDecorator.isInvalid = false;
      this.$.feedbackDecorator.isInvalid = true;
      return;
    }
    this.$.sendingFeedbackDialog.open();
    ui_context.ui.sendFeedback({
      email: this.email,
      error: this.error,
      feedback: this.feedback,
      logs: this.$.logCheckbox.checked,
      browserInfo: navigator.userAgent,
      feedbackType: this.feedbackType
    }).then(() => {
      // Reset the placeholders, which seem to be cleared after the
      // user types input in the input fields.
      this.$.emailInput.placeholder = ui.i18n_t('EMAIL_PLACEHOLDER');
      this.$.feedbackInput.placeholder = ui.i18n_t('FEEDBACK_PLACEHOLDER');
      this.$.errorInput.selected = 'null';
      this.$.errorDecorator.isInvalid = false;
      this.$.feedbackDecorator.isInvalid = false;
      // Clear the form.
      this.email = '';
      this.error = '';
      this.feedback = '';
      this.$.logCheckbox.checked = false;
      // root.ts listens for open-dialog signals and shows a popup
      // when it receives these events.
      this.$.state.openDialog(dialogs.getMessageDialogDescription(
          translator.i18n_t('THANK_YOU'),
          translator.i18n_t('FEEDBACK_SUBMITTED'),
          translator.i18n_t('DONE'))).then(() => {
        this.fire('core-signal', { name: 'close-settings' });
      }, () => {/*MT*/});
      this.close();
      this.$.sendingFeedbackDialog.close();
    }).catch((e :Error) => {
      this.$.state.openDialog(dialogs.getMessageDialogDescription(
          translator.i18n_t('EMAIL_INSTEAD_TITLE'),
          translator.i18n_t('EMAIL_INSTEAD_MESSAGE')));
      this.$.sendingFeedbackDialog.close();
    });
  },
  updateError: function(event: Event, detail: any, sender: HTMLElement) {
    if (detail.isSelected) {
      this.error = detail.item.getAttribute('errorCode');
      if (this.$.errorInput.selected == 0) {
        this.feedbackType = uproxy_core_api.UserFeedbackType.CLOUD_CONNECTIONS_DISCONNECTED;
      } else if (this.$.errorInput.selected ==  1) {
        this.feedbackType = uproxy_core_api.UserFeedbackType.CLOUD_SERVER_NO_CONNECT;
      } else if (this.$.errorInput.selected ==  2) {
        this.feedbackType = uproxy_core_api.UserFeedbackType.TROUBLE_SIGNING_IN;
      } else if (this.$.errorInput.selected ==  3) {
        this.feedbackType = uproxy_core_api.UserFeedbackType.NO_FRIENDS;
      } else if (this.$.errorInput.selected ==  4) {
        this.feedbackType = uproxy_core_api.UserFeedbackType.TROUBLE_STARTING_CONNECTION;
      } else if (this.$.errorInput.selected ==  5) {
        this.feedbackType = uproxy_core_api.UserFeedbackType.DISCONNECTED_FROM_FRIEND;
      } else if (this.$.errorInput.selected ==  6) {
        this.feedbackType = uproxy_core_api.UserFeedbackType.OTHER_FEEDBACK;
      } else {
        this.feedbackType = uproxy_core_api.UserFeedbackType.USER_INITIATED;
      }
    }
  },
  viewLogs: function() {
    this.ui.openTab('generic_ui/view-logs.html?lang=' + model.globalSettings.language);
  },
  ready: function() {
    this.ui = ui_context.ui;
    this.model = ui_context.model;
  },
  computed: {
    'opened': '$.feedbackPanel.opened'
  },
});
