/// <reference path='./context.d.ts' />
/// <reference path='../../../third_party/polymer/polymer.d.ts' />

import * as translator from '../scripts/translator';
import * as uproxy_core_api from '../../interfaces/uproxy_core_api';
import * as ui_constants from '../../interfaces/ui';
import * as user from '../scripts/user';

var ui = ui_context.ui;

const DEFAULT_PROVIDER = 'digitalocean';

Polymer({
  open: function() {
    // Set translated HTML content - need to use injectBoundHTML
    // in order to enable <uproxy-faq-link>, etc tags in the text.
    this.injectBoundHTML(
        translator.i18nSanitizeHtml(translator.i18n_t('CLOUD_INSTALL_GET_STARTED_MESSAGE')),
        this.$.getStartedMessage);
    this.injectBoundHTML(
        translator.i18nSanitizeHtml(translator.i18n_t('CLOUD_INSTALL_EXISTING_SERVER_MESSAGE')),
        this.$.existingServerMessage);
    this.injectBoundHTML(
        translator.i18nSanitizeHtml(translator.i18n_t('CLOUD_INSTALL_CREATE_ACCOUNT_MESSAGE')),
        this.$.createAccountMessage);
    this.injectBoundHTML(
        translator.i18nSanitizeHtml(translator.i18n_t('CLOUD_INSTALL_CREATE_SERVER_MESSAGE')),
        this.$.createServerMessage);

    this.showFirstOverlay();
  },
  showFirstOverlay: function () {
    this.closeOverlays();
    this.$.signUpOrSignInOverlay.open();
  },
  showCreateServerOverlay: function() {
    this.closeOverlays();
    this.$.createServerOverlay.open();
  },
  launchDigitalOceanSettings: function() {
    ui.openTab('https://cloud.digitalocean.com/droplets');
  },
  launchFeedback: function() {
      this.fire('core-signal', {
      name: 'open-feedback', data: {
        feedbackType: uproxy_core_api.UserFeedbackType.CLOUD_SERVER_NO_START
      }
    });
  },
  back: function() {
    if (this.$.failureOverlay.opened) {
      this.showFirstOverlay();
    } else {
      this.closeOverlays();
    }
  },
  closeOverlays: function() {
    this.$.signUpOrSignInOverlay.close();
    this.$.createServerOverlay.close();
    this.$.installingOverlay.close();
    this.$.successOverlay.close();
    this.$.failureOverlay.close();
  },
  createServer: function() {
    if (!this.$.installingOverlay.opened) {
      this.closeOverlays();
      this.installStatus = '';
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
      this.$.state.background.updateGlobalSetting('shouldHijackDO', false);
    }).catch((e :any) => {
      this.closeOverlays();
      this.$.failureOverlay.open();
    });
  },
  select: function(e: Event, d: Object, input: HTMLInputElement) {
    input.focus();
    input.select();
  },
  ready: function() {
    this.model = ui.model;
  },
  computed: {
    'opened': '$.signUpOrSignInOverlay.opened || $.createServerOverlay.opened || $.installingOverlay.opened || $.successOverlay.opened || $.failureOverlay.opened'
  }
});
