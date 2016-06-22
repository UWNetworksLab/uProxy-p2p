/// <reference path='./context.d.ts' />
/// <reference path='../../../../third_party/typings/browser.d.ts' />
/// <reference path='../../../../third_party/polymer/polymer.d.ts' />

import uproxy_core_api = require('../../interfaces/uproxy_core_api');
import ui_constants = require('../../interfaces/ui');
import user = require('../scripts/user');

var ui = ui_context.ui;

const DEFAULT_PROVIDER = 'digitalocean';

Polymer({
  open: function() {
    // Set translated HTML content - need to use injectBoundHTML
    // in order to enable <uproxy-faq-link>, etc tags in the text.
    this.injectBoundHTML(
        ui.i18nSanitizeHtml(ui.i18n_t('CLOUD_INSTALL_GET_STARTED_MESSAGE')),
        this.$.getStartedMessage);
    this.injectBoundHTML(
        ui.i18nSanitizeHtml(ui.i18n_t('CLOUD_INSTALL_EXISTING_SERVER_MESSAGE')),
        this.$.existingServerMessage);
    this.injectBoundHTML(
        ui.i18nSanitizeHtml(ui.i18n_t('CLOUD_INSTALL_CREATE_ACCOUNT_MESSAGE')),
        this.$.createAccountMessage);
    this.injectBoundHTML(
        ui.i18nSanitizeHtml(ui.i18n_t('CLOUD_INSTALL_LOGIN_MESSAGE')),
        this.$.loginMessage);

    this.$.getStartedOverlay.open();
  },
  showLoginOverlay: function() {
    this.closeOverlays();
    this.$.loginOverlay.open();
  },
  launchDigitalOceanSignup: function() {
    // DigitalOcean referral codes trump promo codes,
    // so only add our refcode to the url if the user has no promo code.
    const havePromo = this.$.havePromoCode.checked;
    const registerUrl = 'https://cloud.digitalocean.com/registrations/new';
    const registerUrlWithRefcode = registerUrl + '?refcode=5ddb4219b716';
    ui.openTab(havePromo ? registerUrl : registerUrlWithRefcode);
  },
  launchDigitalOceanSettings: function() {
    ui.openTab('https://cloud.digitalocean.com/droplets');
  },
  back: function() {
    if (this.$.loginOverlay.opened || this.$.failureOverlay.opened) {
      this.closeOverlays();
      this.$.getStartedOverlay.open();
    } else {
      this.closeOverlays();
    }
  },
  closeOverlays: function() {
    this.$.getStartedOverlay.close();
    this.$.loginOverlay.close();
    this.$.installingOverlay.close();
    this.$.successOverlay.close();
    this.$.failureOverlay.close();
    this.$.serverExistsOverlay.close();
    this.$.cancelingOverlay.close();
  },
  loginTapped: function() {
    const createId = Math.floor((Math.random() * 1000000)) + 1;
    this.mostRecentCreateId = createId;

    if (!this.$.installingOverlay.opened) {
      this.closeOverlays();
      ui.cloudInstallStatus = '';
      this.$.installingOverlay.open();
    }
    ui.cloudUpdate({
      operation: uproxy_core_api.CloudOperationType.CLOUD_INSTALL,
      providerName: DEFAULT_PROVIDER,
      region: this.$.regionMenu.selected
    }).then(() => {
      this.closeOverlays();
      this.$.successOverlay.open();
      ui.model.globalSettings.shouldHijackDO = false;
      ui.core.updateGlobalSettings(ui.model.globalSettings);
    }).catch((e :any) => {
      // TODO: Figure out why e.message is not set
      if (e === 'Error: server already exists') {
        this.closeOverlays();
        this.$.serverExistsOverlay.open();
      } else if (this.mostRecentCreateId === createId) {
        // The user did not cancel: clean up the now-useless droplet
        // and show a sad-face, rainy day dialog.
        ui.cloudUpdate({
          operation: uproxy_core_api.CloudOperationType.CLOUD_DESTROY,
          providerName: DEFAULT_PROVIDER
        });
        this.closeOverlays();
        this.$.failureOverlay.open();
      }
    });
  },
  removeServerAndInstallAgain: function() {
    this.mostRecentCreateId = 0;
    this.closeOverlays();
    ui.cloudInstallStatus = ui.i18n_t('REMOVING_UPROXY_CLOUD_STATUS');
    this.$.installingOverlay.open();
    // Destroy uProxy cloud server
    return ui.cloudUpdate({
      operation: uproxy_core_api.CloudOperationType.CLOUD_DESTROY,
      providerName: DEFAULT_PROVIDER
    }).then(() => {
      // Get locally created cloud contact if there is one
      return ui.getCloudUserCreatedByLocal().then((user: user.User) => {
        return ui_context.core.removeContact({
          networkName: user.network.name,
          userId: user.userId
        });
      }).catch((e: Error) => {
        // Locally created cloud server does not exist
        // so no need to remove contact
        return Promise.resolve<void>();
      });
    }).then(() => {
      return this.loginTapped();
    });
  },
  cancelCloudInstall: function() {
    this.mostRecentCreateId = 0;
    this.$.cancelingOverlay.open();
    return ui.cloudUpdate({
      operation: uproxy_core_api.CloudOperationType.CLOUD_DESTROY,
      providerName: DEFAULT_PROVIDER
    }).then(() => {
      this.closeOverlays();
      ui.toastMessage = ui.i18n_t('CLOUD_INSTALL_CANCEL_SUCCESS');
    }).catch((e: Error) => {
      this.$.cancelingOverlay.close();
      ui.toastMessage = ui.i18n_t('CLOUD_INSTALL_CANCEL_FAILURE');
    });
  },
  select: function(e: Event, d: Object, input: HTMLInputElement) {
    input.focus();
    input.select();
  },
  ready: function() {
    this.ui = ui;
    // ID of the latest attempt to create a server, used to distinguish
    // between install failures that should be flagged to the user and
    // failures owing to cancellation. We use a random number rather
    // than a simple boolean because, in the event of cancellation, it
    // can take *several* seconds for the installer to fail by which time
    // the user could have initiated a whole new install.
    this.mostRecentCreateId = 0;
  },
  promoIdChanged: function() {
    // do not uncheck the box if we no longer have the promo id set
    if (ui.model.globalSettings.activePromoId) {
      this.$.havePromoCode.checked = true;
    }
  },
  havePromoChanged: function () {
    ui.model.globalSettings.activePromoId = this.$.havePromoCode.checked;
  },
  observe: {
    'ui.model.globalSettings.activePromoId': 'promoIdChanged'
  }
});
