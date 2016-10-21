/// <reference path='../../../../third_party/typings/index.d.ts'/>
/// <reference path='../../../generic_ui/polymer/context.d.ts' />

import * as background_ui from '../../../generic_ui/scripts/background_ui';
import * as ui_model from '../../../generic_ui/scripts/model';
import * as user_interface from '../../../generic_ui/scripts/ui';
import CoreConnector from '../../../generic_ui/scripts/core_connector';
import CordovaCoreConnector from './cordova_core_connector';
import * as same_context_panel_connector from '../../../generic_ui/scripts/same_context_panel_connector';

import * as social from '../../../interfaces/social';
import * as uproxy_core_api from '../../../interfaces/uproxy_core_api';

export var browserConnector = new CordovaCoreConnector({name: 'uproxy-ui-to-core-connector'});
export var core = new CoreConnector(browserConnector);
export var ui :user_interface.UserInterface;
export var model :ui_model.Model;

export var panelConnector = new same_context_panel_connector.SameContextPanelConnector();
var backgroundUi = new background_ui.BackgroundUi(panelConnector, core);

class Proxy {
  public constructor(private core: uproxy_core_api.CoreApi) {}

  public start() {
    console.log('Starting proxy');
    // this.core.start(<social.InstancePath>{
    //   network: {
    //     name: 'Cloud',
    //     userId: ''
    //   },
    //   userId: user.userId,
    //   instanceId: instanceId
    // });
  }
}

// For debugging
(window as any).context = this;

function main() {
  let token: social.InviteTokenData = {
    v: 1,
    networkName: 'Cloud',
    userName: 'MyPeer',
    networkData: '~%27*7b*22host*22*3a*2245.55.107.160*22*2c*22user*22*3a*22getter*22*2c*22key*22*3a*22LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlEZlFJQkFBS0J3UUM1M2R4WWU5U1hTNmx3MGh4RE5qSjdvWExoRXE3MGxnRTJhRnFrYVJROFNLcW9vSjhQCmJxRE1QWTBjekVxSGZYcEZEaGZ0MXF1MkpVQ3ZxZXZwRTQ3SmpSaitrSTlQZmF2eTQ3U2RtM3RmT0lSN0IzNVkKRGN2UW12UkpVQTdyV1JNNVV6TndoaTBzZm5EdzVlVmhTOVdPMWRCdWgwSUNHSC80Q3QrWjMrendjV1huc2U2cwoyd0Z5b2dyUUpnL3hVSGJzMk1IeWNLNEtxQnZWTVp2OVFJV3ROZXBBUHFMS3F3M3VKckdJbFZUb0Rvd3hzNE9tCnh6a2NEZ1IvclYrVjVSY0NBd0VBQVFLQndRQ1BidjRQTHFpVmhTY2lVSkxNNzNNdjR4eXpRbWJQaXo4dVRJTysKb3ZTaHZQWXVJWjMrRzhKdE93YTk5WTJDVjd2V3RKU1V6M2c5blN2NUkrbFJPZTJUN3BZZVJWTEM1bG1lbkVpUwo1QnptRThodzVReUVTVWxERjRGelhodlZWU3ZtK09kRTRCZk1OYk9RWExJNzdJa0xwR1VDcDE5UzlGNG81RXhuClBMY29Nbm1IMDlwZkZSbjNBb3E1ZlFGZWhlZzdYUmZQMzgraGZzWHFoT0FSdGtuckc0ei9DVmFGME9rbmFRVFYKUlRqMVU5R1JweXpRT0htdVNqZG1Oa3c0eHBrQ1lRRGRXejZsRXRQZnMwOUVwZVcxSnJPaTU0dUs3MENsSkZZYgpkZWtRb0llZWhSQ0hXU2RLVnFNODArTUJvblVHa2QyRVczM2dieEtzSEo4dzRteDBiZDNTenZzSWh1blVRK2lUCjlFVGtxdzhTc1RCZnhya1ZMN1plTC9OeGhiNWxvK1VDWVFEVzlMTkZYMEFIcldKeGRMd0hVd0NxTFFXWW55WEsKaUc3UkxPUWlRVHN3OFVLUFpqVHVzaVE3WEU2Y04ya20zME9qeS9JS0JVdGR2amxqc1FyU3lmdE12dHR4ZmNIVApMa2dydHJQd2J4VTJVYjlZL0NRdVBoMXRFNld4VEQxSFRVc0NZUURQNTAxMVdiT3FYZzNMbWsyZjBWUFRZOHFLCm1hQ0wrdzd0QjlmNWgrMFpGRDJzQWk2SEFjeWI2eDlCZjhhT2Z4NGhuSlVqNE84V3ZHTkFWTW9zcUt3NXZiSEcKRm9FMG52dXBTem9SMUNCNkcvWWxYczZqZVlhOS9DZVlybGRmdTRrQ1lBa2J1MUR3TlUxZCtuTG1TR1ZqRGY4bwpBem14WEsrVlVtVElxeTRNWjQ2dVdteXJId2tTUVZqR2s0b3BDdXFid1VqNmhsb0lXV1l5ZmtvTUlYSkhIci9rCnduV3ZwM3ZrVlNpTkNGaml6QnBPSW5hSjBKcXBCU1F2RmZGS1VycG51d0pnYjUzaWZBWEJPeW1OOEpwYmliaDYKRkZOOXE1aTZoZlNIQ0N6b1k5bXpKdUtNSEY3ZGRhMElpQXdQMTQ2QnZnT1Z2ZzQ4TnhCclBTYXlweS9PUm11OApyeC9GZS9mWUhUK3M5bStaSEo1OXlrR3BEOVJpQzh4VmtiSGhxWmhIdkVETgotLS0tLUVORCBSU0EgUFJJVkFURSBLRVktLS0tLQo*3d*22*7d'
  };
  core.acceptInvitation({
    network: {name: 'Cloud', userId: ''},
    tokenObj: token
  }).then(() => {
    console.debug('Invitation accepted');
  }).catch(console.error);

  let proxy = new Proxy(core);
  document.getElementById('connect-button').onclick = (ev) => {
    console.debug('Pressed Connect Button');
    proxy.start();
  };
}

document.addEventListener('DOMContentLoaded', function (event) {
  core.getFullState().then((state) => {
    console.debug('Starting main()');
    console.log(state);
    main();
  });
});

// function main() {
//   chrome.runtime.getBackgroundPage((bgPage) => {
//     var ui_context = (<any>bgPage).ui_context;
//     ui = new user_interface.UserInterface(core, ui_context.browserApi, backgroundUi);
//     model = ui.model;
//     console.log('Got references from background page; importing vulcanized');
//     // loadPolymer();
//   });

//   document.getElementById('connect-button').onclick = (ev) => {
//     console.debug('Connect');

//     let localProxy = new socks_to_rtc.SocksToRtc();

//     let tcpServer = new tcp.Server({
//         address: '127.0.0.1',
//         port: 0
//     });

//     let config :freedom.RTCPeerConnection.RTCConfiguration = {
//       iceServers: constants.DEFAULT_STUN_SERVERS.slice(0)
//     };
//     let peerConnection = new peerconnection.PeerConnectionClass(
//       freedom['core.rtcpeerconnection'](config), 'sockstortc');
//     localProxy.start(tcpServer, peerConnection).then((endpoint) => {
//       console.log('Connected %s', endpoint);
//     }).catch((error) => {
//       console.error('Failed to start Socks-to-RTC server: %s', error);
//     });
//   };state

//   // Force a repaint every 300 ms.
//   // Extremely hacky workaround for https://crbug.com/612836

//   let sendResize = true;

//   setInterval(function () {
//     if (sendResize) {
//       window.dispatchEvent(new Event('resize'));
//     } else {
//       console.debug('suppressed resize event');
//     }
//   }, 300);

//   // Workaround for janky inviteUserPanel transition,
//   // which is caused by the workaround above.
//   // https://github.com/uProxy/uproxy/issues/2659
//   document.addEventListener('uproxy-root-ready', function () {
//     // The 'uproxy-root-ready' event is dispatched in the `ready()` method of
//     // the uproxy root object instantiated in src/generic_ui/polymer/root.ts.
//     console.debug('got uproxy-root-ready');
//     let inviteButton = document.querySelector('uproxy-root /deep/ #inviteButton');
//     if (!inviteButton) {
//       console.error('#inviteButton missing:', inviteButton);
//       return;
//     }
//     inviteButton.addEventListener('tap', function () {
//       sendResize = false;
//       setTimeout(function () { sendResize = true; }, 2000);
//     });
//   });
// }


