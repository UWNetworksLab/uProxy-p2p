/// <reference path='../../../third_party/cordova/splashscreen.d.ts'/>
/// <reference types="chrome/chrome-app" />

/**
 * background.ts
 *
 * This file must be included *after* the freedom script and manifest are
 * loaded.
 */

import { ServerListPage } from '../ui_components/server_list';
import { Server, ServerRepository } from '../model/server';
import { UproxyServer, UproxyServerRepository } from './uproxy_server';
import { SshSocksProxy } from './ssh_socks_proxy';
import { GetGlobalTun2SocksVpnDevice } from './tun2socks_vpn_device';
import * as vpn_device from '../model/vpn_device';
import * as intents from './intents';
import * as jsurl from 'jsurl';
import uparams = require('uparams');

document.addEventListener('deviceready', (event) => {
  console.debug('Cordova loaded');
  main();
});

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
function getLocalStorage(): Storage {
  try {
    const storage = window['localStorage'];
    const x = '__storage_test__';
    storage.setItem(x, x);
    storage.removeItem(x);
    return localStorage;
  } catch (e) {
    throw new Error('localStorage unavailable');
  }
}

function main() {
  let serversPromise = GetGlobalTun2SocksVpnDevice().then((vpnDevice) => {
    console.debug('Device supports VPN');
    return vpnDevice;
  }).catch((error) => {
    // TODO(fortuna): Properly notify the user that the device is not supported.
    console.error(error);
    return new vpn_device.NoOpVpnDevice();
  }).then((vpnDevice) => {
    let servers = new UproxyServerRepository(getLocalStorage(), vpnDevice);
    return servers;
  });

  // Create UI.
  let serversListPagePromise: Promise<ServerListPage> = new Promise((resolve, reject) => {
    serversPromise.then((servers) => {
      console.debug('servers ready');
      resolve(new ServerListPage(
        document.body.querySelector('#server-list'), servers));
    });
  });

  // Register for url intents.
  Promise.all([serversListPagePromise, intents.GetGlobalIntentInterceptor()]).then(
    ([serverListPage, intentInterceptor]) => {
      console.debug('Registering intent listener');
      intentInterceptor.addIntentListener((url: string) => {
        console.debug(`[App] Url: ${url}`);
        const params = uparams(url);
        if (!('code' in params)) {
          return;
        }
        const accessCode = params.code;
        console.debug(`Access code: ${accessCode}`);
        serverListPage.enterAccessCode(accessCode);
      });
      if (navigator.splashscreen) {
        navigator.splashscreen.hide();
      }
    }
  );
}
