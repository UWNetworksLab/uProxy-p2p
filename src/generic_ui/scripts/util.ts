import translator = require('./translator');

export function getDialogObject(
    heading: string,
    message: string,
    buttonText: string = null,
    displayData: string = null) {
  return {
    heading: heading,
    message: message,
    buttons: [{
      text: buttonText || translator.i18n_t('OK')
    }],
    displayData: displayData
  }
}

export function getInputObject(
    heading: string,
    message: string,
    placeholderText: string,
    defaultValue: string,
    buttonText: string) {
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

export function getConfirmationObject(
    heading: string,
    message: string,
    dismissButtonText: string = null,
    fulfillButtonText: string = null) {
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
