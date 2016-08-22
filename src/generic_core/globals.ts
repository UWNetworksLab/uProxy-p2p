/// <reference path='../../third_party/typings/index.d.ts' />

import _ = require('lodash');
import active_user_metrics = require('./active-user-metrics')
import constants = require('./constants');
import local_storage = require('./storage');
import logging = require('../lib/logging/logging');
import loggingprovider = require('../lib/loggingprovider/loggingprovider.types');
import rappor_metrics = require('./rappor-metrics');
import user_interface = require('../interfaces/ui');
import uproxy_core_api = require('../interfaces/uproxy_core_api');

declare const freedom: freedom.FreedomInModuleEnv;

var log :logging.Log = new logging.Log('globals');

export var storage = new local_storage.Storage();

// Initially, the STUN servers are a copy of the default.
// We need to use slice to copy the values, otherwise modifying this
// variable can modify DEFAULT_STUN_SERVERS as well.
export var settings :uproxy_core_api.GlobalSettings = {
  description: '',
  stunServers: constants.DEFAULT_STUN_SERVERS.slice(0),
  hasSeenSharingEnabledScreen: false,
  hasSeenWelcome: false,
  hasSeenMetrics: false,
  allowNonUnicast: false,
  mode: user_interface.Mode.GET,
  version: constants.STORAGE_VERSION,
  statsReportingEnabled: false,
  consoleFilter: loggingprovider.Level.warn,
  language: null,  // sentinel indicating lang should be calculated from browser settings
  force_message_version: 0, // zero means "don't override"
  quiverUserName: '',
  proxyBypass: constants.DEFAULT_PROXY_BYPASS.slice(0),
  enforceProxyServerValidity: false,
  validProxyServers: {},
  activePromoId: null,  // set on promoIdDetected
  enabledExperiments: [],
  shouldHijackDO: true,
  crypto: true,
  reproxy: {
    enabled: false,
    socksEndpoint: {address: '127.0.0.1', port: 9050},
  }
};

export var natType :string = '';

export var loadSettings :Promise<void> =
  storage.load<uproxy_core_api.GlobalSettings>('globalSettings')
    .then((settingsFromStorage :uproxy_core_api.GlobalSettings) => {
      log.info('Loaded global settings', settingsFromStorage);

      // Use the setting values loaded from storage unless the value was not
      // set in storage in which case we should use the default value.
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
  return settings.force_message_version || constants.MESSAGE_VERSION;
}

export const metrics = freedom['metrics'] ?
    new rappor_metrics.FreedomMetrics(storage) :
    new rappor_metrics.NoOpMetrics();
export const activeUserMetrics = new active_user_metrics.Metrics(storage);

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
