/// <reference path='./context.d.ts' />
require('polymer');

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
    // The keys below correspond with UserFeedbackType enum values
    // in uproxy_core_api.ts
    var messages : {[key: number]: [string, string]} = {
      0: ['FEEDBACK_SUBMITTED', 'FEEDBACK_TITLE'],
      1: ['FEEDBACK_SUBMITTED', 'FEEDBACK_TITLE'],
      2: ['FEEDBACK_SUBMITTED', 'FEEDBACK_TITLE'],
      3: ['FEEDBACK_SUBMITTED', 'FEEDBACK_TITLE'],
      4: ['FEEDBACK_SUBMITTED', 'FEEDBACK_TITLE'],
      5: ['TROUBLE_SIGNING_IN_TITLE', 'TROUBLE_SIGNING_IN_HELP'],
      6: ['NO_FRIENDS_TITLE', 'NO_FRIENDS_HELP'],
      7: ['CANT_START_CONNECTION_TITLE', 'CANT_START_CONNECTION_HELP'],
      8: ['FEEDBACK_SUBMITTED', 'FEEDBACK_TITLE'],
      9: ['FEEDBACK_SUBMITTED', 'FEEDBACK_TITLE']
    };
      // root.ts listens for open-dialog signals and shows a popup
      // when it receives these events.
      this.$.state.openDialog(dialogs.getMessageDialogDescription(
          translator.i18n_t(messages[this.$.errorInput.selected][1]),
          translator.i18n_t(messages[this.$.errorInput.selected][0]),
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
