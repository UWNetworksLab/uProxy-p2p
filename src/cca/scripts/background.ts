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
import { UproxyServerRepository } from './uproxy_server';
import { makeCoreConnector } from './cordova_core_connector';
import { GetGlobalTun2SocksVpnDevice } from './tun2socks_vpn_device';
import * as vpn_device from '../model/vpn_device';
import * as intents from './intents';
import * as jsurl from 'jsurl';
import * as uproxy_core_api from '../../interfaces/uproxy_core_api';

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

// We save this reference to allow inspection of the context state from the browser debuggin tools.
(window as any).context = this;

// TODO(fortuna): Get rid of core connector and talk to the core directly.
let corePromise = makeCoreConnector();

let serversPromise = GetGlobalTun2SocksVpnDevice().then((vpnDevice) => {
  console.debug('Device supports VPN');
  return vpnDevice;
}).catch((error) => {
  // TODO(fortuna): Properly notify the user that the device is not supported.
  console.error(error);
  return new vpn_device.NoOpVpnDevice();
}).then((vpnDevice) => {
  try {
    return new UproxyServerRepository(getLocalStorage(), corePromise, vpnDevice);
  } catch (e) {
    console.warn('local storage unavailable, showing mock servers');
    return <ServerRepository>{
      addServer(code) {
        throw new Error('unsupported operation');
      },
      getServers() {
        return [
          <Server>{
            getIpAddress() {
              return '192.168.1.1';
            },
            connect(callback) {
              return Promise.resolve();
            },
            disconnect() {
              return Promise.resolve();
            }
          },
          <Server>{
            getIpAddress() {
              return 'broken.mydomain.com';
            },
            connect(callback) {
              return Promise.reject(new Error('unreachable host'));
            },
            disconnect() {
              return Promise.resolve();
            }
          }
        ];
      }
    };
  }
});

// Create UI.
let serversListPagePromise: Promise<ServerListPage> = new Promise((resolve, reject) => {
  chrome.app.runtime.onLaunched.addListener(() => {
    console.debug('Chrome onLaunched fired');
    chrome.app.window.create('index_vulcanized.html', {
      // When running as a Chrome extension for the first time,
      // open in a 16:9 vertical aspect ratio. This a very common
      // aspect ratio:
      //   https://material.io/devices/
      id: 'uProxy',
      innerBounds: {
        width: 400,
        height: 712
      }
    }, (appWindow) => {
      console.debug('window created');
      let document = appWindow.contentWindow.document;
      document.addEventListener('DOMContentLoaded', function (event) {
        console.debug('dom ready');
        serversPromise.then((servers) => {
          console.debug('servers ready');
          resolve(new ServerListPage(
            appWindow.contentWindow.document.body.querySelector('#server-list'),
            servers));
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
