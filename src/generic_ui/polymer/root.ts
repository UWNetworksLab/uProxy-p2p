/// <reference path='./context.d.ts' />
/// <reference path='../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../../../third_party/typings/index.d.ts' />

import _ = require('lodash');
import social = require('../../interfaces/social');
import translator = require('../scripts/translator');
import ui_types = require('../../interfaces/ui');
import user_interface = require('../scripts/ui');
import user_module = require('../scripts/user');
import dialogs = require('../scripts/dialogs');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');

var ui = ui_context.ui;
var model = ui_context.model;
var RTL_LANGUAGES :string[] = ['ar', 'fa', 'ur', 'he'];

// Since we reuse a uproxy-action-dialog, sometimes there is a race condition
// where the dialog attempts to open before it is properly closed.
// We use a Promise to track if the dialog is closed.
// The Promise is fulfilled by default, and also after a
// "core-overlay-open-completed" event is observed.
// The Promise is reset each time we open the dialog.
var reusableDialogClosedPromise = Promise.resolve<void>();
var fulfillReusableDialogClosed :Function;

Polymer({
  dialog: {
    message: '',
    heading: '',
    buttons: []
  },
  toastMessage: '',
  unableToGet: '',
  unableToShare: '',
  gettingStatus: null,
  sharingStatus: null,
  viewChanged: function(oldView :ui_types.View, newView :ui_types.View) {
    // If we're switching from the SPLASH page to the ROSTER, fire an
    // event indicating the user has logged in. roster.ts listens for
    // this event.
    if (newView == ui_types.View.ROSTER && oldView == ui_types.View.SPLASH) {
      // TODO: can this be removed now that roster-before-login has launched?
      this.fire('core-signal', {name: 'login-success'});
      this.closeSettings();
      this.$.modeTabs.updateBar();

      // User has now seen the welcome messages - this used to be a
      // uproxy-bubble, now the only welcome content is on the splash screen
      // and the empty roster text.
      model.globalSettings.hasSeenWelcome = true;
      this.$.state.background.updateGlobalSetting('hasSeenWelcome', true);
    }
  },
  statsIconClicked: function() {
    this.$.mainPanel.openDrawer();
  },
  closeSettings: function() {
    this.$.mainPanel.closeDrawer();
  },
  setGetMode: function() {
    ui.setMode(ui_types.Mode.GET);
  },
  setShareMode: function() {
    ui.setMode(ui_types.Mode.SHARE);
  },
  closedWelcome: function() {
  },
  closedSharing: function() {
    model.globalSettings.hasSeenSharingEnabledScreen = true;
    this.$.state.background.updateGlobalSetting('hasSeenSharingEnabledScreen', true);
  },
  closeDialog: function() {
    this.$.dialog.close();
  },
  openDialog: function(e :Event, detail :ui_types.DialogDescription) {
    /* 'detail' parameter holds the data that was passed when the open-dialog
     * signal was fired. It should be of the form:
     *
     * { heading: 'title for the dialog',
     *   message: 'main message for the dialog',
     *   buttons: [{
     *     text: 'button text, e.g. Done',
     *     dismissive: boolean, whether button is dismissive (optional)
     *   }]
     * }
     */

    if (detail.userInputData && detail.userInputData.initInputValue) {
      this.$.dialogInput.value = detail.userInputData.initInputValue;
    } else if (detail.displayData) {
      this.$.dialogDisplay.value = detail.displayData;
    } else {
      this.$.dialogInput.value = '';
    }
    this.isUserInputInvalid = false;

    // Set heading and message innerHTML so translations can include
    // <p>, <a>, <strong>, etc tags.
    this.injectBoundHTML(
        ui.i18nSanitizeHtml(detail.heading), this.$.dialogHeading);
    this.injectBoundHTML(
        ui.i18nSanitizeHtml(detail.message), this.$.dialogMessage);

    this.dialog = detail;
    // Using async() allows the contents of the dialog to update before
    // it's opened. Opening the dialog too early causes it to be positioned
    // incorrectly (i.e. off center).
    this.async(() => {
      // Do not open the dialog until we are sure it is closed.
      reusableDialogClosedPromise.then(() => {
        reusableDialogClosedPromise = new Promise<void>((F, R) => {
          fulfillReusableDialogClosed = F;
        });
        this.$.dialog.open();
      });
    });
  },
  dialogButtonClick: function(event :Event, detail :Object, target :HTMLElement) {
    // Get userInput, or set to undefined if it is '', null, etc
    var userInput = this.$.dialogInput.value || undefined;
    if (this.dialog.userInputData && !userInput) {
      // User did not enter any input, don't close
      this.isUserInputInvalid = true;
      return;
    }

    this.isUserInputInvalid = false;

    var fulfill = (target.getAttribute('affirmative') !== null);
    this.$.state.handleDialogClick(fulfill, userInput);
    this.$.dialog.close();
  },
  selectAll: function(e :Event, d :Object, input :HTMLInputElement) {
    input.focus();
    input.select();
  },
  reusableDialogClosed: function() {
    fulfillReusableDialogClosed();
  },
  openProxyError: function() {
    this.$.proxyError.open();
  },
  openReproxyError: function() {
    this.$.reproxyError.open();
  },
  closeReproxyError: function() {
    this.$.reproxyError.close();
  },
  ready: function() {
    // Expose global ui object and UI module in this context.
    this.ui = ui;
    this.core = ui_context.core;
    this.ui_constants = ui_types;
    this.user_interface = user_interface;
    this.model = model;
    if (ui.browserApi.browserSpecificElement){
      var browserCustomElement = document.createElement(ui.browserApi.browserSpecificElement);
      this.$.browserElementContainer.appendChild(browserCustomElement);
    }
    this.setDirectionality();
    // Logic that depends on the uproxy-root element being ready
    // (as in src/cca/app/polymer/workarounds.ts)
    // can be scheduled appropriately by listening for this event:
    document.dispatchEvent(new Event('uproxy-root-ready'));
  },
  tabSelected: function(e :Event) {
    if (this.ui.isSharingDisabled &&
        this.model.globalSettings.mode == ui_types.Mode.SHARE) {
      // Keep the mode on get and display an error dialog.
      this.ui.setMode(ui_types.Mode.GET);
      this.$.state.openDialog(dialogs.getMessageDialogDescription(
          translator.i18n_t('SHARING_UNAVAILABLE_TITLE'),
          translator.i18n_t('SHARING_UNAVAILABLE_MESSAGE'),
          translator.i18n_t('CLOSE')));
    } else {
      // setting the value is taken care of in the polymer binding, we just need
      // to sync the value to core
      this.$.state.background.updateGlobalSetting('mode', model.globalSettings.mode);
    }
  },
  revertProxySettings: function() {
    this.ui.stopUsingProxy(true);
    this.openAskForFeedback();
  },
  restartProxying: function() {
    this.ui.restartProxying();
  },
  showToast: function(e: Event, detail: { toastMessage: string, unableToGet?: boolean, unableToShare?: boolean }) {
    this.toastMessage = detail.toastMessage;
    this.unableToGet = detail.unableToGet || false;
    this.unableToShare = detail.unableToShare || false;
    this.$.toast.show();
  },
  openTroubleshoot: function() {
    if (this.unableToGet) {
      this.troubleshootTitle = ui.i18n_t('UNABLE_TO_GET');
    } else {
      this.troubleshootTitle = ui.i18n_t('UNABLE_TO_SHARE');
    }
    this.$.toast.dismiss();
    this.fire('core-signal', {name: 'open-troubleshoot'});
  },
  topOfStatuses: function(statusHeight: number, visible :boolean) {
    return visible ? statusHeight : 0;
  },
  // mainPanel.selected can be either "drawer" or "main"
  // Our "drawer" is the settings panel. When the settings panel is open,
  // make sure to hide the stats tooltip so the two don't overlap.
  drawerToggled: function() {
    if (this.$.mainPanel.selected == 'drawer') {
      // Drawer was opened.
      this.$.statsTooltip.disabled = true;
      this.$.settings.accountChooserOpen = false;
    } else {
      // Drawer was closed.
      // Cancel the user's edits to the description, if they haven't saved
      this.$.settings.$.description.cancelEditing();
      this.$.statsTooltip.disabled = false;
    }
  },
  isSharingEnabledWithOthers: false,
  updateIsSharingEnabledWithOthers: function() {
    var trustedContacts = model.contacts.shareAccessContacts.trustedUproxy;
    if (trustedContacts.length === 1) {
      this.isSharingEnabledWithOthers =
          trustedContacts[0].userId !== trustedContacts[0].network.userId;
    } else {
      this.isSharingEnabledWithOthers = trustedContacts.length > 0;
    }
  },
  /*
   * Set our `dir` value to 'ltr' or 'rtl' based on current language.
   */
  setDirectionality: function() {
    if (_.includes(RTL_LANGUAGES, model.globalSettings.language)) {
      this.dir = 'rtl';
    } else {
      this.dir = 'ltr';
    }
  },
  restart: function() {
    this.$.state.background.restart();
  },
  fireOpenInviteUserPanel: function() {
    this.fire('core-signal', { name: 'open-invite-user-dialog' });
  },
  openAskForFeedback: function() {
    this.$.state.openDialog(dialogs.getConfirmationDialogDescription(
        translator.i18n_t('ASK_FOR_FEEDBACK_TITLE'),
        translator.i18n_t('ASK_FOR_FEEDBACK_CONNECTION_DISCONNECTED'))).then(
      () => {
        this.fire('core-signal', {
          name: 'open-feedback',
          data: {
            feedbackType: uproxy_core_api.UserFeedbackType.DISCONNECTED_FROM_FRIEND
          }
        });
      },
      () => { /* MT */ });
  },
  updateGettingStatus: function(e: Event, gettingStatus?: string) {
    this.gettingStatus = gettingStatus;
  },
  updateSharingStatus: function(e: Event, sharingStatus?: string) {
    this.sharingStatus = sharingStatus;
  },
  handleBackButton: function() {
    // If the generic dialog is open, it's the highest-level thing in the UI
    if (this.$.dialog.opened) {
      this.closeDialog();
      return;
    }

    // Handle non-roster cases (browser error or splash screen)
    if (ui.view === ui_types.View.SPLASH) {
      if (this.$.splash.state > 0) {
        this.$.splash.state--;
        return;
      }

      ui.browserApi.exit();
      return;
    }

    if (ui.view === ui_types.View.BROWSER_ERROR) {
      ui.browserApi.exit();
      return;
    }

    // Definitely on the roster at this point, go through views
    const panelIds = ['faq', 'feedback', 'advancedSettings'];
    for (let i in panelIds) {
      const el = this.$[panelIds[i]];
      if (el.opened) {
        el.close();
        return;
      }
    }

    // InviteUser is more complicated, just calling exit would be deceptive,
    // this seems cleaner than having a check for if back exists on each
    // element in the above list
    if (this.$.inviteUser.opened) {
      this.$.inviteUser.back();
      return;
    }

    // If we're simply on the roster, close settings if open, otherwise exit
    if (this.$.mainPanel.selected === 'drawer') {
      this.$.mainPanel.closeDrawer();
      return;
    }

    ui.browserApi.exit();
  },
  observe: {
    '$.mainPanel.selected': 'drawerToggled',
    'ui.view': 'viewChanged',
    // Use an observer on model.contacts.shareAccessContacts.trustedUproxy
    // so that we can detect any time elements are added or removed from this
    // array.  Unfortunately if we try doing
    //   someMethod(model.contacts.shareAccessContacts.trustedUproxy)
    // in root.html, someMethod is not invoked when items are added or removed.
    'model.contacts.shareAccessContacts.trustedUproxy':
        'updateIsSharingEnabledWithOthers',
    'model.globalSettings.language': 'setDirectionality'
  },
  computed: {
    'hasContacts': '(model.contacts.getAccessContacts.pending.length + model.contacts.getAccessContacts.trustedUproxy.length + model.contacts.getAccessContacts.untrustedUproxy.length + model.contacts.shareAccessContacts.pending.length + model.contacts.shareAccessContacts.trustedUproxy.length + model.contacts.shareAccessContacts.untrustedUproxy.length) > 0',
   }
});
