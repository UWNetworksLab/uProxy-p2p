/**
 * core.ts
 *
 * This is the primary uproxy code. It maintains in-memory state,
 * checkpoints information to local storage, and synchronizes state with the
 * front-end.
 *
 * In-memory state includes:
 *  - Roster, which is a list of contacts, always synced with XMPP friend lists.
 *  - Instances, which is a list of active uProxy installs.
 */

/// <reference path='../../../third_party/typings/freedom/freedom.d.ts' />

import logging = require('../../../third_party/uproxy-lib/logging/logging');
import uproxy_core_api = require('../interfaces/uproxy_core_api');
import social = require('../interfaces/social');
import social_network = require('./social');
import version = require('../version/version');
import browser_connector = require('../interfaces/browser_connector');
import ui = require('./ui_connector');
import uproxy_core = require('./uproxy_core');
import logging_types = require('../../../third_party/uproxy-lib/loggingprovider/loggingprovider.types');
import rtc_to_net = require('../../../third_party/uproxy-lib/rtc-to-net/rtc-to-net');
import socks_to_rtc = require('../../../third_party/uproxy-lib/socks-to-rtc/socks-to-rtc');
import globals = require('./globals');
import metrics_module = require('./metrics');

import ui_connector = ui.connector;


// Prepare all the social providers from the manifest.
social_network.initializeNetworks();

// --------------------------------------------------------------------------
// Register Core responses to UI commands.
// --------------------------------------------------------------------------
var core = new uproxy_core.uProxyCore();

// These are exported for debugging from the browser console.
var exported = {
  core: core,
  moduleName: 'uProxy Core Freedom Module',
  social_network: social_network,
  version: version,
  browser_connector: browser_connector,
  ui_connector: ui_connector,
  loggingController: uproxy_core.loggingController,
  logging_types: logging_types,
  socks_to_rtc: socks_to_rtc,
  rtc_to_net: rtc_to_net,
  globals: globals
};
export = exported;

ui_connector.onPromiseCommand(
    uproxy_core_api.Command.LOGIN,
    core.login);

ui_connector.onPromiseCommand(
    uproxy_core_api.Command.LOGOUT,
    core.logout);

ui_connector.onCommand(uproxy_core_api.Command.MODIFY_CONSENT,
    core.modifyConsent);

ui_connector.onPromiseCommand(
    uproxy_core_api.Command.START_PROXYING_COPYPASTE_GET,
    core.startCopyPasteGet);

ui_connector.onPromiseCommand(
    uproxy_core_api.Command.STOP_PROXYING_COPYPASTE_GET,
    core.stopCopyPasteGet);

ui_connector.onCommand(
    uproxy_core_api.Command.START_PROXYING_COPYPASTE_SHARE,
    core.startCopyPasteShare);

ui_connector.onPromiseCommand(
    uproxy_core_api.Command.STOP_PROXYING_COPYPASTE_SHARE,
    core.stopCopyPasteShare);

ui_connector.onCommand(
    uproxy_core_api.Command.COPYPASTE_SIGNALLING_MESSAGE,
    core.sendCopyPasteSignal);

ui_connector.onPromiseCommand(
    uproxy_core_api.Command.START_PROXYING,
    core.start);

ui_connector.onPromiseCommand(
    uproxy_core_api.Command.SEND_INVITATION,
    core.inviteUser);

ui_connector.onPromiseCommand(
    uproxy_core_api.Command.GET_INVITE_URL,
    core.getInviteUrl);

ui_connector.onCommand(uproxy_core_api.Command.SEND_EMAIL,
    core.sendEmail);

ui_connector.onCommand(uproxy_core_api.Command.STOP_PROXYING,
    core.stop);

ui_connector.onCommand(
    uproxy_core_api.Command.HANDLE_MANUAL_NETWORK_INBOUND_MESSAGE,
    core.handleManualNetworkInboundMessage);

ui_connector.onCommand(
    uproxy_core_api.Command.UPDATE_GLOBAL_SETTINGS,
    core.updateGlobalSettings);

ui_connector.onPromiseCommand(
    uproxy_core_api.Command.GET_LOGS,
    core.getLogsAndNetworkInfo);

ui_connector.onPromiseCommand(
    uproxy_core_api.Command.GET_NAT_TYPE,
    core.getNatType);

ui_connector.onPromiseCommand(
    uproxy_core_api.Command.REFRESH_PORT_CONTROL,
    core.refreshPortControlSupport);

ui_connector.onPromiseCommand(
    uproxy_core_api.Command.GET_FULL_STATE,
    core.getFullState);

ui_connector.onCommand(uproxy_core_api.Command.HANDLE_CORE_UPDATE,
    core.handleUpdate);

ui_connector.onPromiseCommand(uproxy_core_api.Command.GET_VERSION,
    core.getVersion);

var dailyMetricsReporter = new metrics_module.DailyMetricsReporter(
    globals.metrics, globals.storage, core.getNetworkInfoObj,
    (payload :any) => {
      if (globals.settings.statsReportingEnabled) {
        ui_connector.update(
            uproxy_core_api.Update.POST_TO_CLOUDFRONT,
            {payload: payload, cloudfrontPath: 'submit-rappor-stats'});
      }
    });

ui_connector.onPromiseCommand(
    uproxy_core_api.Command.PING_UNTIL_ONLINE,
    core.pingUntilOnline);

ui_connector.onPromiseCommand(
    uproxy_core_api.Command.ACCEPT_INVITATION,
    core.acceptInvitation);

