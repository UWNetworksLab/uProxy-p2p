/// <reference path='../../../third_party/typings/freedom/freedom-module-env.d.ts' />
/// <reference path='../../../third_party/typings/lodash/lodash.d.ts' />

import _ = require('lodash');
import local_storage = require('./storage');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import loggingprovider = require('../../../third_party/uproxy-lib/loggingprovider/loggingprovider.types');
import metrics_module = require('./metrics');
import user_interface = require('../interfaces/ui');
import uproxy_core_api = require('../interfaces/uproxy_core_api');

var log :logging.Log = new logging.Log('globals');

export var storage = new local_storage.Storage();

export var STORAGE_VERSION = 1;

// 1: initial release
// 2: uproxy-lib v27, move to bridge but no obfuscation yet
// 3: offer basicObfuscation
// 4: holographic ICE
export var MESSAGE_VERSION = 5;

export var DEFAULT_STUN_SERVERS = [
  {urls: ['stun:stun.l.google.com:19302']},
  {urls: ['stun:stun.services.mozilla.com']},
  {urls: ['stun:stun.stunprotocol.org']}
];

  // Initially, the STUN servers are a copy of the default.
  // We need to use slice to copy the values, otherwise modifying this
  // variable can modify DEFAULT_STUN_SERVERS as well.
export var settings :uproxy_core_api.GlobalSettings = {
  description: '',
  stunServers: DEFAULT_STUN_SERVERS.slice(0),
  hasSeenSharingEnabledScreen: false,
  hasSeenWelcome: false,
  allowNonUnicast: false,
  mode: user_interface.Mode.GET,
  version: STORAGE_VERSION,
  splashState: 0,
  statsReportingEnabled: false,
  consoleFilter: loggingprovider.Level.warn,
  language: 'en',
  force_message_version: 0, // zero means "don't override"
  // TODO: remove this in November 2015, to allow 1 month for existing users to
  // see the notification that Google+Facebook social providers have changed.
  hasSeenGoogleAndFacebookChangedNotification: false,
  quiverUserName: ''
};

export var natType :string = '';

export var loadSettings :Promise<void> =
  storage.load<uproxy_core_api.GlobalSettings>('globalSettings')
    .then((settingsFromStorage :uproxy_core_api.GlobalSettings) => {
      log.info('Loaded global settings', settingsFromStorage);

      // Use the setting values loaded from storage unless the value was not
      // set in storage in which case we should use the default value (set
      // above)
      _.merge(settings, settingsFromStorage, (a :Object, b :Object) => {
        if (_.isArray(a) && _.isArray(b)) {
          // arrays should be replaced instead of combined
          return b;
        }

        if (_.isNull(b)) {
          // treat null the same as undefined to make sure support does not break
          return a;
        }

        // this causes us to fall back to the default merge behaviour
        return undefined;
      });
    }).catch((e) => {
      log.info('No global settings loaded', e.message);
    });

// Client version to run as, which is globals.MESSAGE_VERSION unless
// overridden in advanced settings.
export var effectiveMessageVersion = () : number => {
  return settings.force_message_version || MESSAGE_VERSION;
}

export var metrics = new metrics_module.Metrics(storage);

export var publicKey :string;
export var pgp :freedom.PgpProvider.PgpProvider = freedom['pgp']();

pgp.setup('', '<uproxy>').then(() => {
  pgp.exportKey().then((key :freedom.PgpProvider.PublicKey) => {
    publicKey = key.key;
  });
}).catch((e) => {
  log.error('Error setting up pgp ', e);
});

export var portControl = freedom['portControl']();
