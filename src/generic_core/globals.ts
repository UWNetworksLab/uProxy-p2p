/// <reference path='../../../third_party/typings/browser.d.ts' />

import _ = require('lodash');
import local_storage = require('./storage');
import logging = require('../lib/logging/logging');
import loggingprovider = require('../lib/loggingprovider/loggingprovider.types');
import metrics_module = require('./metrics');
import user_interface = require('../interfaces/ui');
import uproxy_core_api = require('../interfaces/uproxy_core_api');

declare const freedom: freedom.FreedomInModuleEnv;

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

const DEFAULT_PROXY_BYPASS = [
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
];

// Initially, the STUN servers are a copy of the default.
// We need to use slice to copy the values, otherwise modifying this
// variable can modify DEFAULT_STUN_SERVERS as well.
export var settings :uproxy_core_api.GlobalSettings = {
  description: '',
  stunServers: DEFAULT_STUN_SERVERS.slice(0),
  hasSeenSharingEnabledScreen: false,
  hasSeenWelcome: false,
  hasSeenMetrics: false,
  allowNonUnicast: false,
  mode: user_interface.Mode.GET,
  version: STORAGE_VERSION,
  splashState: 0,
  statsReportingEnabled: false,
  consoleFilter: loggingprovider.Level.warn,
  language: 'en',
  force_message_version: 0, // zero means "don't override"
  quiverUserName: '',
  showCloud: false,
  proxyBypass: DEFAULT_PROXY_BYPASS.slice(0),
  enforceProxyServerValidity: false,
  validProxyServers: [],
  activePromoId: null,  // set on promoIdDetected
  enabledExperiments: [],
  shouldHijackDO: true,
  crypto: true,
  reproxy: {enabled: false, socksEndpoint: {address: '127.0.0.1', port: 9050}}
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
