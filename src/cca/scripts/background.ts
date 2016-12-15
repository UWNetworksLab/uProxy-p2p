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
import { Server } from '../model/server';
import * as vpn_device from '../model/vpn_device';
import * as intents from './intents';
import * as uproxy_core_api from '../../interfaces/uproxy_core_api';

console.debug('Background loaded into webview');

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
function getLocalStorage(): Storage {
  try {
    const storage = window['localStorage'];
    const x = '__storage_test__';
    storage.setItem(x, x);
    storage.removeItem(x);
    return localStorage;
  } catch(e) {
    throw new Error('localStorage unavailable');
  }
}

// We save this reference to allow inspection of the context state from the browser debuggin tools.
(window as any).context = this;

// TODO(fortuna): Get rid of core connector and talk to the core directly.
let corePromise = MakeCoreConnector();
const ACCESS_CODE = "https://www.uproxy.org/invite/?v=2&networkName=Cloud&networkData=~'*7b*22host*22*3a*22188.166.131.247*22*2c*22user*22*3a*22getter*22*2c*22key*22*3a*22LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlEZlFJQkFBS0J3UUMrL3hNRkExQjVTeWVCaFRDMitZYVFQdUF3WllGVlRHd29QNVVXVTlLTVRiZTQrbStwCnZCbmYwQXlpNFJhclM2UVhpZFZ5QWR4V3ZWM0VzOUZhVmFGY1lia3dPa0RxcGZvakR3bjh5VDlqY2V2SklQOGYKRDVZczFWOCsrNkRKaWpTeG8xRUdBbU5veW1KRkFqdWk5VmVoMElrQWVKTlBHSHp4TFlXR05rSTBIeG1tT1RRdgppZWs0S3FIOUJZc2p6RGZ2aENqNUFQeWwxVlBaWDdmRGRUT2paWGR6SXJxUXZrbm8xdDFvWkdwWnJpZG1nLzhMCnJvRTVMUHMwc1c1UjY1TUNBd0VBQVFLQndCVGhsRFcvR0FRNnlEWHIxdGlhVFREbC91S3Jwa2txRXNVUHRuLzcKYUJCNHlyWkpndjIrbCtHVlFGeHFXVzBlMXZEUDIrc2I4dmYwdWhTd1NCb2xOSUFDR3huL3RHc3kvRGJyQlArRApEUkFWTzE4QTRZT0cwN2RSR0ptdEx2WDV5dnFNSnJwVk9kSS9pTWhIeWVFUjBlc29SenNSV3pTVGluL3l1NWM0CkxOdjJ4QW0xOVBJMmtHTVZsY2JjMXExb0txUEphRTJucUF5OUI1bFJNdUw2R09rdHBIa0ZuZ2FMWkxTbXl0QUsKUk5BYy9XbDNYQWFPdlFQNXFrZjN3UFdVSVFKaEFPMVUzYnc0TFU0UTQ2TlZMWjYzdGIwRjRJQ3hqbFNMOHJ4bApnb2VUWTdpV1dsbDI3Q3RYTTRDeG1yWmxiZVQwWkpPWGtYeERjbjV3MzdDYmZIdENKcmtWRTZFTVhsQmpKNHBHCko5ZWJmb2o0NU9nMWtnc3RQdm41eUI5RVp1cWVvd0poQU00RktPc2I2eW5LSkxVcDdEakdBdVkvM3psVmlKdU4KMHNwZkRrQkhlSXJFcWtZbU1VbGFCcm81bEFoNFpsYTNQU2V2dExZb29YaVEvdjJjNHVyVzZLUG9XOTF5THN4SwozbGJkbmlJWHZyOCtWWVZSUkR6bFVON1FYUUhZVTVEK1VRSmhBTmJWQjVLbFYzMWZGSEI1WGo1YUZZenhrUE50CnhtVUorY1JJTHd3Q2d6WklBNmtRV1dBeUkxRFBkRGkvUCtjTXd5NUcrVTcrenRsZDIxN0dvTHdDZVlMNGJUaFAKTmVDV29PZ3Q4VXJlV29BcXJTcjFzeW1pMzJyd2pCS2huSGVzK1FKZ0pxSnRFL24rVmEza3lGeCtRZjlRRitHdQplTkFEZURoV2FVRCtLU3U5L1RmNFBvTjNCcXh0U29yMXFjajZXQlN3MFRwd0J5RURkdHFxRnVGTzVIODh6VkFMCnVqRnBlVUlwQTkwM2hHa3ppaVdrWUFYbmFBd1E2RmZtdVN2YUwveWhBbUVBcVJwREphZWJPSDRnMGwzTDlPejgKT0pJR1NEUWpxK0U0Z1ZKZHdsc0crZVFnMks5eUxhNWxiSU9UR2U2YTJhRmtMa2t5RzVTSVFsbnRYaEpFU095TwpNNndiNFdnNjhkUFFxRmFTdXlRelpGeEUxZEkxYytHRjUwc2NXeDdFY1NpQwotLS0tLUVORCBSU0EgUFJJVkFURSBLRVktLS0tLQo*3d*22*7d";

let serversPromise = GetGlobalTun2SocksVpnDevice().then((vpnDevice) => {
  console.debug('Device supports VPN');
  return vpnDevice;
}).catch((error) => {
  console.error(error);
  return new vpn_device.NoOpVpnDevice();
}).then((vpnDevice) => {
  return new UproxyServerRepository(getLocalStorage(), corePromise, vpnDevice);
// }).then(function (servers) {
//     console.debug('Adding server');
//     return servers.addServer(ACCESS_CODE);
// }).then(function (server) {
//     console.debug('Connecting to server');
//     server.connect(function (msg) {
//         console.log("disconnected: " + msg);
//     });
});

// Create UI.
let serversListPagePromise: Promise<ServerListPage> = new Promise((resolve, reject) => {
  chrome.app.runtime.onLaunched.addListener(() => {
    console.debug('Chrome onLaunched fired');
    chrome.app.window.create('index_vulcanized.html', null, (appWindow) => {
      console.debug('window created');
      let document = appWindow.contentWindow.document;
      document.addEventListener('DOMContentLoaded', function (event) {
        console.debug('dom ready');
        serversPromise.then((servers) => {
          console.debug('servers ready');
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
