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
  feedback: '',
  logs: '',
  feedbackType: null,
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
    if (data && data.feedbackType) {
      this.feedbackType = data.feedbackType;
    }
    this.$.feedbackPanel.open();
  },
  sendFeedback: function() {
    this.feedback = this.feedback.trim();
    //if user does not select something from dropdown
    if (this.$.errorInput.selected == null) {
        this.$.errorDecorator.isInvalid = true;
        return;
    }

    //if user selects 'other', make sure that additional feedback is required
    if (this.feedbackType == uproxy_core_api.UserFeedbackType.OTHER_FEEDBACK && !this.feedback.length) {
      this.$.errorDecorator.isInvalid = false;
      this.$.feedbackDecorator.isInvalid = true;
      this.$.collapse.opened = false;
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
      // root.ts listens for open-dialog signals and shows a popup
      // when it receives these events.
      if (this.$.errorInput.selected == 4) {
        var feedbackTypeDialog = translator.i18n_t('FEEDBACK_SUBMITTED_4');
      }
      else if (this.$.errorInput.selected == 5) {
        var feedbackTypeDialog = translator.i18n_t('FEEDBACK_SUBMITTED_5');
      }
      else {
        var feedbackTypeDialog = translator.i18n_t('FEEDBACK_SUBMITTED');
      }
      this.$.state.openDialog(dialogs.getMessageDialogDescription(
          translator.i18n_t('THANK_YOU'),
          feedbackTypeDialog,
          translator.i18n_t('DONE'))).then(() => {
        this.fire('core-signal', { name: 'close-settings' });
      }, () => {/*MT*/});
      this.close();
      this.$.sendingFeedbackDialog.close();
      // Reset the placeholders, which seem to be cleared after the
      // user types input in the input fields.
      this.$.emailInput.placeholder = ui.i18n_t('EMAIL_PLACEHOLDER');
      this.$.feedbackInput.placeholder = ui.i18n_t('FEEDBACK_PLACEHOLDER');
      this.$.errorInput.selected = 'null';
      this.$.errorDecorator.isInvalid = false;
      this.$.feedbackDecorator.isInvalid = false;
      this.$.dropdownContainer.textContent = ui.i18n_t('CUSTOM_ERROR_PLACEHOLDER');
      this.$.collapse.opened = false;



      // Clear the form.
      this.email = '';
      this.feedback = '';
      this.feedbackType = null;
      this.$.logCheckbox.checked = false;
    }).catch((e :Error) => {
      this.$.state.openDialog(dialogs.getMessageDialogDescription(
          translator.i18n_t('EMAIL_INSTEAD_TITLE'),
          translator.i18n_t('EMAIL_INSTEAD_MESSAGE')));
      this.$.sendingFeedbackDialog.close();
    });
  },
  toggleDropdown: function() {
    this.$.collapse.toggle();
  },
  changePlaceholder: function(event: Event, detail: any, sender: HTMLElement) {
    if (detail.isSelected) {
      this.$.dropdownContainer.textContent = detail.item.textContent;
      this.$.collapse.opened = false;
    }
  },
  viewLogs: function() {
    // calls to logs.html to view logs
    this.fire('core-signal', { name: 'open-logs' });
  },
  ready: function() {
    this.ui = ui_context.ui;
    this.model = ui_context.model;
    this.UserFeedbackType = uproxy_core_api.UserFeedbackType;
  },
  computed: {
    'opened': '$.feedbackPanel.opened'
  },
});
