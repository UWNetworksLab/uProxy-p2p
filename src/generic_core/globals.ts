import local_storage = require('./storage');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import uproxy_core_api = require('../interfaces/uproxy_core_api');
import user_interface = require('../interfaces/ui');

var log :logging.Log = new logging.Log('globals');

export var storage = new local_storage.Storage();

export var STORAGE_VERSION = 1;
export var MESSAGE_VERSION = 1;

export var DEFAULT_STUN_SERVERS_ = [
  {urls: ['stun:stun.services.mozilla.com']},
  {urls: ['stun:stun.stunprotocol.org']},
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun3.l.google.com:19302',
      'stun:stun4.l.google.com:19302'
    ]
  }
];

  // Initially, the STUN servers are a copy of the default.
  // We need to use slice to copy the values, otherwise modifying this
  // variable can modify DEFAULT_STUN_SERVERS_ as well.
export var settings :uproxy_core_api.GlobalSettings = {
  description: '',
  stunServers: DEFAULT_STUN_SERVERS_.slice(0),
  hasSeenSharingEnabledScreen: false,
  hasSeenWelcome: false,
  allowNonUnicast: false,
  mode: user_interface.Mode.GET,
  version: STORAGE_VERSION,
  statsReportingEnabled: false
};

export var natType :string = '';

export var loadSettings :Promise<void> =
  storage.load<uproxy_core_api.GlobalSettings>('globalSettings')
    .then((settingsObj :uproxy_core_api.GlobalSettings) => {
      log.info('Loaded global settings', settingsObj);
      settings = settingsObj;
      // If no custom STUN servers were found in storage, use the default
      // servers.
      if (!settings.stunServers
          || settings.stunServers.length == 0) {
        settings.stunServers = DEFAULT_STUN_SERVERS_.slice(0);
      }
      // If storage does not know if this user has seen a specific overlay
      // yet, assume the user has not seen it so that they will not miss any
      // onboarding information.
      if (settings.hasSeenSharingEnabledScreen == null) {
        settings.hasSeenSharingEnabledScreen = false;
      }
      if (settings.hasSeenWelcome == null) {
        settings.hasSeenWelcome = false;
      }
      if (settings.allowNonUnicast == null) {
        settings.allowNonUnicast = false;
      }
      if (typeof settings.mode == 'undefined') {
        settings.mode = user_interface.Mode.GET;
      }
      if (settings.statsReportingEnabled == null) {
        settings.statsReportingEnabled = false;
      }
    }).catch((e) => {
      log.info('No global settings loaded', e.message);
    });
