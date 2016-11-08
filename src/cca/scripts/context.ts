import { AppComponent } from './app_component';
import { MakeCoreConnector } from './cordova_core_connector';
import { CloudSocksProxyRepository } from './cloud_socks_proxy_server';
import { GetGlobalTun2SocksVpnDevice } from './tun2socks_vpn_device';

// We save this reference to allow inspection of the context state from the browser debuggin tools.
(window as any).context = this;

let core = MakeCoreConnector();

function main() {
  console.debug('Starting main()');
  let app = new AppComponent(
      document, new CloudSocksProxyRepository(core), GetGlobalTun2SocksVpnDevice());
  chrome.runtime.getBackgroundPage((bgPage) => {
    (<any>bgPage).ui_context.getIntentUrl().then((url: string) => {
      console.debug(`[Context] Url: ${url}`);
      app.enterAccessCode(url);
    });
  });
}

document.addEventListener('DOMContentLoaded', function (event) {
  // TODO(fortuna): For some reason I'm getting:
  // "TypeError: Cannot read property 'acceptInvitation' of null"
  // If I click "Set Proxy" too soon after the splash screen.
  core.getFullState().then((state) => {
    console.log(state);
    main();
  });
});
