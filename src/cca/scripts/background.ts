/// <reference path='../../../third_party/cordova/splashscreen.d.ts'/>

/**
 * background.ts
 *
 * This file must be included *after* the freedom script and manifest are
 * loaded.
 */

import * as uproxy_core_api from '../../interfaces/uproxy_core_api';

import { AppComponent } from './app_component';
import { CloudSocksProxyRepository } from './cloud_socks_proxy_server';
import { CordovaBrowserApi } from './cordova_browser_api';
import { MakeCoreConnector } from './cordova_core_connector';
import { GetGlobalTun2SocksVpnDevice } from './tun2socks_vpn_device';

declare const freedom: freedom.FreedomInCoreEnv;

export interface OnEmitModule extends freedom.OnAndEmit<any,any> {};
export interface OnEmitModuleFactory extends
  freedom.FreedomModuleFactoryManager<OnEmitModule> {};

// TODO(fortuna): Move browser api logic directly here. No need for the extra layer.
const browserApi :CordovaBrowserApi = new CordovaBrowserApi();

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

chrome.app.runtime.onLaunched.addListener(function () {
  console.debug('Chrome onLaunched fired');
  chrome.app.window.create('index.html', null, (appWindow) => {
    let document = appWindow.contentWindow.document;
    document.addEventListener('DOMContentLoaded', function (event) {
      let app = new AppComponent(appWindow.contentWindow.document,
        new CloudSocksProxyRepository(core), GetGlobalTun2SocksVpnDevice());
      intentUrl.then((url: string) => {
        console.debug(`[App] Url: ${url}`);
        app.enterAccessCode(url);
      });
    });
  });
});
