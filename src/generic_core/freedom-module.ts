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

/// <reference path='../../../third_party/freedom-typings/freedom-module-env.d.ts' />
/// <reference path='../../../third_party/freedom-typings/social.d.ts' />

import logging = require('../../../third_party/uproxy-lib/logging/logging');
import uproxy_core_api = require('../interfaces/uproxy_core_api');
import social_network = require('./social');
import version = require('../version/version');
import browser_connector = require('../interfaces/browser_connector');
import ui = require('./ui_connector');
import uproxy_core = require('./uproxy_core');

import ui_connector = ui.connector;

// Prepare all the social providers from the manifest.
social_network.initializeNetworks();

// --------------------------------------------------------------------------
// Register Core responses to UI commands.
// --------------------------------------------------------------------------
var core = new uproxy_core.uProxyCore();
var exported = {
  core: core,
  moduleName: 'uProxy Core Freedom Module',
  social_network: social_network,
  version: version,
  browser_connector: browser_connector,
  ui_connector: ui_connector
};
export = exported;

ui_connector.onCommand(
    uproxy_core_api.Command.GET_INITIAL_STATE,
    ui_connector.sendInitialState);

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
