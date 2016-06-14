import translator = require('./translator');
import ui = require('../../interfaces/ui');

/**
 * This gets a description object for a dialog that will simply show the text
 * given in message with a single button for confirmation
 */
export function getDialogObject(
    heading: string,
    message: string,
    buttonText?: string,
    displayData?: string): ui.DialogDescription {
  return {
    heading: heading,
    message: message,
    buttons: [{
      text: buttonText || translator.i18n_t('OK')
    }],
    displayData: displayData
  }
}

/**
 * This gets a dialog description object that will have a single text box
 * asking the user for a value.  There will be a single button offering the
 * user the option to submit the entered text.
 */
export function getInputObject(
    heading: string,
    message: string,
    placeholderText: string,
    defaultValue: string,
    buttonText: string): ui.DialogDescription  {
  return {
    heading: heading,
    message: message,
    buttons: [{
      text: buttonText
    }],
    userInputData: {
      placeholderText: placeholderText,
      initInputValue: defaultValue
    }
  }
}

/**
 * This gets a dialog description object that will have two buttons, one that
 * allows the user to proceed and one that cancels the operation
 */
export function getConfirmationObject(
    heading: string,
    message: string,
    dismissButtonText?: string,
    fulfillButtonText?: string): ui.DialogDescription  {
  return {
    heading: heading,
    message: message,
    buttons: [{
      text: dismissButtonText ? dismissButtonText : translator.i18n_t('NO'),
      dismissive: true
    }, {
      text: fulfillButtonText ? fulfillButtonText : translator.i18n_t('YES')
    }]
  };
}

export function getLogoutConfirmationMessage(isGetting: boolean, isSharing: boolean): string {
  if (isGetting && isSharing) {
    return translator.i18n_t('CONFIRM_LOGOUT_GETTING_AND_SHARING');
  } else if (isGetting) {
    return translator.i18n_t('CONFIRM_LOGOUT_GETTING');
  } else if (isSharing) {
    return translator.i18n_t('CONFIRM_LOGOUT_SHARING');
  }

  return null;
}
