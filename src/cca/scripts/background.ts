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
    try {
      return new UproxyServerRepository(
        getLocalStorage(), core, vpnDevice);
    } catch (e) {
      console.warn('local storage unavailable');
      const serverRepository = new UproxyServerRepository({
        length: 0,
        clear: () => {
          throw new Error('this is mock storage');
        },
        getItem: (key: string) => {
          throw new Error('this is mock storage');
        },
        key: (index: number) => {
          throw new Error('this is mock storage');
        },
        removeItem: (key: string) => {
          throw new Error('this is mock storage');
        },
        setItem: (key: string, data: string) => {
          throw new Error('this is mock storage');
        }
      }, core, vpnDevice);
      return serverRepository;
    }
  });
});

// Create UI.
let serversListPagePromise: Promise<ServerListPage> = new Promise((resolve, reject) => {
  chrome.app.runtime.onLaunched.addListener(() => {
    console.debug('Chrome onLaunched fired');
    chrome.app.window.create('index_vulcanized.html', {
      // When running as a Chrome extension for the first time,
      // open in a nice Nexus 5-like 16:9 aspect ratio (vertically).
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
          const listElem = appWindow.contentWindow.document.body.querySelector('#server-list') as HTMLElement;
          const serverListPage = new ServerListPage(listElem, servers);
          appWindow.contentWindow.addEventListener('resize', () => {
            serverListPage.resizeCards();
          });
          resolve(serverListPage);
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

// Add some mock servers if we are running as a Chrome extension.
serversListPagePromise.then((serverListPage) => {
  try {
    getLocalStorage();
  } catch (e) {
    serverListPage.enterAccessCode('/?v=2&networkName=Cloud&networkData=' + encodeURIComponent(jsurl.stringify({
      host: '192.168.1.1',
      key: btoa('a fake SSL key')
    })));
    serverListPage.enterAccessCode('/?v=2&networkName=Cloud&networkData=' + encodeURIComponent(jsurl.stringify({
      host: 'myhost.mydomain.com',
      key: btoa('another fake SSL key')
    })));
  };
});
