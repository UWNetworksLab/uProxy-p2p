/// <reference path='../../../third_party/cordova/splashscreen.d.ts'/>
/// <reference path='../../../third_party/cordova/webintents.d.ts'/>		
/// <reference types="chrome/chrome-app" />

/**
 * background.ts
 *
 * This file must be included *after* the freedom script and manifest are
 * loaded.
 */

import * as uproxy_core_api from '../../interfaces/uproxy_core_api';

import { ServerListPage } from '../ui_components/server_list';
import { UproxyServerRepository } from './uproxy_server';
import { MakeCoreConnector } from './cordova_core_connector';
import { GetGlobalTun2SocksVpnDevice } from './tun2socks_vpn_device';
import * as vpn_device from '../model/vpn_device';

declare const freedom: freedom.FreedomInCoreEnv;

export interface OnEmitModule extends freedom.OnAndEmit<any,any> {};
export interface OnEmitModuleFactory extends
  freedom.FreedomModuleFactoryManager<OnEmitModule> {};

let intentUrl = new Promise((resolve, reject) => {
  window.top.document.addEventListener('deviceready', () => {
    if (!window.top.webintent) {
      reject('windomw.top.webintent not found (Not running on Android?)');
      return;
    }
    window.top.webintent.getUri((url: string) => {
      resolve(url);
    });
  });
});

intentUrl.then((url) => {
  console.debug(`[Background] Url is [${url}]`);
});

console.log('Loading core');
export var uProxyAppChannel = freedom(
    'generic_core/freedom-module.json',
    <freedom.FreedomInCoreEnvOptions>{
      'logger': 'lib/loggingprovider/freedom-module.json',
      'debug': 'debug',
      'portType': 'worker'
    }
).then((uProxyModuleFactory:OnEmitModuleFactory) => {
  console.log('Core loading complete');
  return uProxyModuleFactory();
});

// We save this reference to allow inspection of the context state from the browser debuggin tools.
(window as any).context = this;

let core = MakeCoreConnector();

let serversPromise = GetGlobalTun2SocksVpnDevice().then((vpnDevice) => {
  console.debug('Device supports VPN');
  return vpnDevice;
}).catch((error) => {
  console.error(error);
  return new vpn_device.NoOpVpnDevice();
}).then((vpnDevice) => {
  return new UproxyServerRepository(core, vpnDevice);
});

chrome.app.runtime.onLaunched.addListener(function () {
  console.debug('Chrome onLaunched fired');
  chrome.app.window.create('index.html', null, (appWindow) => {
    let document = appWindow.contentWindow.document;
    document.addEventListener('DOMContentLoaded', function (event) {
      serversPromise.then((servers) => {
        let serverListPage = new ServerListPage(appWindow.contentWindow.document.body, servers);
        intentUrl.then((url: string) => {
          console.debug(`[App] Url: ${url}`);
          serverListPage.enterAccessCode(url);
        });
      });
    });
  });
});
