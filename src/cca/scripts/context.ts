import { MakeCoreConnector } from './cordova_core_connector';

import * as net from '../../lib/net/net.types';
import { CloudSocksProxyServer, SocksProxyServerRepository } from './cloud_socks_proxy_server';
import { GetGlobalTun2SocksVpnDevice } from './tun2socks_vpn_device';

// For debugging
(window as any).context = this;

let core = MakeCoreConnector();

class EventLog {
  constructor(private element_: HTMLElement) {}

  public append(text: string) {
    let wrapped = document.createElement('div');
    wrapped.innerText = text;
    this.element_.appendChild(wrapped);
  }
}

function main() {
  let servers = new SocksProxyServerRepository(core);
  let selectedServerPromise: Promise<CloudSocksProxyServer> = null;
  let proxyEndpoint: net.Endpoint = null;

  // UI Code Below
  let log = new EventLog(document.getElementById('event-log'));
  let addWidget = document.getElementById('setup-widget') as HTMLDivElement;
  let addTokenText = document.getElementById('token-text') as HTMLTextAreaElement;
  let addButton = document.getElementById('set-proxy-button') as HTMLButtonElement;
  let startButton = document.getElementById('start-proxy-button') as HTMLButtonElement;
  let stopButton = document.getElementById('stop-proxy-button') as HTMLButtonElement;

  addButton.onclick = (ev) => {
    console.debug('Pressed Add Button');
    selectedServerPromise = servers.addProxyServer(addTokenText.textContent);
    selectedServerPromise.then((server) => {
      startButton.disabled = false;
      log.append(`Added server at ${server.remoteIpAddress()}`)
    }).catch((error) => {
      console.error(error);
      log.append(error);
    });
  };
  startButton.onclick = (ev) => {
    console.debug('Pressed Start Button');
    if (!selectedServerPromise) {
      throw new Error('No proxy set');
    }
    selectedServerPromise.then((server) => {
      startButton.disabled = true;
      return server.start();
    }).then((endpoint) => {
      proxyEndpoint = endpoint;
      console.log('Endpoint: ', proxyEndpoint);
      log.append(`Proxy running on port ${proxyEndpoint.port}`);
      stopButton.disabled = false;
    }).catch((error) => {
      console.error(error);
      log.append(error);
      startButton.disabled = false;
    });
  };
  stopButton.onclick = (ev) => {
    console.debug('Pressed Stop Button');
    if (!selectedServerPromise) {
      throw new Error('No proxy set');
    }
    selectedServerPromise.then((server) => {
      log.append('Proxy stopped');
      return server.stop();
    }).then(() => {
      startButton.disabled = false;
      stopButton.disabled = true;
    }).catch(console.error);
  };

  // VPN
  let vpnDevicePromise = GetGlobalTun2SocksVpnDevice();
  vpnDevicePromise.catch((error) => { log.append(error); });

  let startVpnButton = document.getElementById('start-vpn-button') as HTMLButtonElement;
  let stopVpnButton = document.getElementById('stop-vpn-button') as HTMLButtonElement;
  startVpnButton.onclick = (ev) => {
    console.debug('Pressed VPN Start Button');
    vpnDevicePromise.then((vpnDevice) => {
      return vpnDevice.start(proxyEndpoint.port, ((msg) => {
        log.append(`Vpn disconnected: ${msg}`);
      }));
    }).then((msg) => {
      log.append(`VPN started: ${msg}`);
    }).catch(console.error);
  };
  stopVpnButton.onclick = (ev) => {
    console.debug('Pressed VPN Stop Button');
    vpnDevicePromise.then((vpnDevice) => {
      return vpnDevice.stop();
    }).then((msg) => {
      log.append(`VPN stopped: ${msg}`);
    }).catch(console.error);
  };
}

document.addEventListener('DOMContentLoaded', function (event) {
  core.getFullState().then((state) => {
    console.debug('Starting main()');
    console.log(state);
    main();
  });
});
