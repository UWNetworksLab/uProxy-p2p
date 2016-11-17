/// <reference path='../../../third_party/cordova/splashscreen.d.ts'/>
/// <reference types="chrome/chrome-app" />

/**
 * background.ts
 *
 * This file must be included *after* the freedom script and manifest are
 * loaded.
 */

import { ServerListPage } from '../ui_components/server_list';
import { UproxyServerRepository } from './uproxy_server';
import { MakeCoreConnector } from './cordova_core_connector';
import { GetGlobalTun2SocksVpnDevice } from './tun2socks_vpn_device';
import * as vpn_device from '../model/vpn_device';
import * as intents from './intents';
import * as uproxy_core_api from '../../interfaces/uproxy_core_api';

// We save this reference to allow inspection of the context state from the browser debuggin tools.
(window as any).context = this;

// TODO(fortuna): Get rid of core connector and talk to the core directly.
// TODO(fortuna): I believe we need to somehow wait for the core to be ready.
let core = MakeCoreConnector();

// Log into the cloud social network and create UproxyServerRepository.
let serversPromise = GetGlobalTun2SocksVpnDevice().then((vpnDevice) => {
  console.debug('Device supports VPN');
  return vpnDevice;
}).catch((error) => {
  console.error(error);
  return new vpn_device.NoOpVpnDevice();
}).then((vpnDevice) => {
  return core.login({
    network: 'Cloud',
    loginType: uproxy_core_api.LoginType.INITIAL,
  }).then(() => {
    return new UproxyServerRepository(core, vpnDevice);
  });
});

// Create UI.
let serversListPagePromise: Promise<ServerListPage> = new Promise((resolve, reject) => {
  chrome.app.runtime.onLaunched.addListener(() => {
    console.debug('Chrome onLaunched fired');
    chrome.app.window.create('index.html', null, (appWindow) => {
      let document = appWindow.contentWindow.document;
      document.addEventListener('DOMContentLoaded', function (event) {
        serversPromise.then((servers) => {
          resolve(new ServerListPage(appWindow.contentWindow.document.body, servers));
        });
      });
    });
  });
});

// Register for url intents.
Promise.all([serversListPagePromise, intents.GetGlobalIntentInterceptor()]).then(
  ([serverListPage, intentInterceptor]) => {
    intentInterceptor.addIntentListener((url: string) => {
      console.debug(`[App] Url: ${url}`);
      serverListPage.enterAccessCode(url);
    });
    if (navigator.splashscreen) {
      navigator.splashscreen.hide();
    }
  }
);
