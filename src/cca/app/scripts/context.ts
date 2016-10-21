/// <reference path='../../../../third_party/typings/index.d.ts'/>
/// <reference path='../../../generic_ui/polymer/context.d.ts' />

import * as jsurl from 'jsurl';

import * as background_ui from '../../../generic_ui/scripts/background_ui';
import * as ui_model from '../../../generic_ui/scripts/model';
import * as user_interface from '../../../generic_ui/scripts/ui';
import CoreConnector from '../../../generic_ui/scripts/core_connector';
import CordovaCoreConnector from './cordova_core_connector';
import * as same_context_panel_connector from '../../../generic_ui/scripts/same_context_panel_connector';

import * as social from '../../../interfaces/social';
import * as uproxy_core_api from '../../../interfaces/uproxy_core_api';
import * as net from '../../../lib/net/net.types';
import * as provider from '../../../lib/cloud/social/provider';

export var browserConnector = new CordovaCoreConnector({name: 'uproxy-ui-to-core-connector'});
export var core = new CoreConnector(browserConnector);
export var ui :user_interface.UserInterface;
export var model :ui_model.Model;

export var panelConnector = new same_context_panel_connector.SameContextPanelConnector();
var backgroundUi = new background_ui.BackgroundUi(panelConnector, core);

// You can test it with
// curl -v -x socks5h://localhost:52612 www.example.com
class AccessProvider {
  private instancePath_: social.InstancePath;

  public constructor(private core_: uproxy_core_api.CoreApi, userId: string) {
    this.instancePath_ = {
      network: {
        name: 'Cloud',
        userId: 'me'
      },
      userId: userId,
      instanceId: userId
    }
  }

  public startProxy(): Promise<net.Endpoint> {
    console.debug('Starting proxy');
    return this.core_.start(this.instancePath_);
  }

  public stopProxy(): Promise<void> {
    console.debug('Stopping proxy');
    return this.core_.stop(this.instancePath_);
  }
}

class ProviderRepository {
  private loginPromise: Promise<uproxy_core_api.LoginResult>;

  constructor(private core_: CoreConnector) {
    this.loginPromise = this.core_.login({
      network: 'Cloud',
      loginType: uproxy_core_api.LoginType.INITIAL,
    });
  }

  public addProvider(token: social.InviteTokenData): Promise<AccessProvider> {
    // Do I need loginPromise?
    return this.core_.acceptInvitation({
      network: {name: 'Cloud'},
      tokenObj: token
    }).then(() => {
      return new AccessProvider(this.core_, (token.networkData as any).host);
    });
  }
}

// For debugging
(window as any).context = this;

function main() {
  let providers = new ProviderRepository(core);
  let selectedProviderPromise: Promise<AccessProvider> = Promise.reject('No provider selected');

  let token: social.InviteTokenData = {
    v: 2,
    networkName: 'Cloud',
    userName: 'MyPeer',
    networkData: JSON.parse(jsurl.parse('~%27*7b*22host*22*3a*2245.55.107.160*22*2c*22user*22*3a*22getter*22*2c*22key*22*3a*22LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlEZlFJQkFBS0J3UUM1M2R4WWU5U1hTNmx3MGh4RE5qSjdvWExoRXE3MGxnRTJhRnFrYVJROFNLcW9vSjhQCmJxRE1QWTBjekVxSGZYcEZEaGZ0MXF1MkpVQ3ZxZXZwRTQ3SmpSaitrSTlQZmF2eTQ3U2RtM3RmT0lSN0IzNVkKRGN2UW12UkpVQTdyV1JNNVV6TndoaTBzZm5EdzVlVmhTOVdPMWRCdWgwSUNHSC80Q3QrWjMrendjV1huc2U2cwoyd0Z5b2dyUUpnL3hVSGJzMk1IeWNLNEtxQnZWTVp2OVFJV3ROZXBBUHFMS3F3M3VKckdJbFZUb0Rvd3hzNE9tCnh6a2NEZ1IvclYrVjVSY0NBd0VBQVFLQndRQ1BidjRQTHFpVmhTY2lVSkxNNzNNdjR4eXpRbWJQaXo4dVRJTysKb3ZTaHZQWXVJWjMrRzhKdE93YTk5WTJDVjd2V3RKU1V6M2c5blN2NUkrbFJPZTJUN3BZZVJWTEM1bG1lbkVpUwo1QnptRThodzVReUVTVWxERjRGelhodlZWU3ZtK09kRTRCZk1OYk9RWExJNzdJa0xwR1VDcDE5UzlGNG81RXhuClBMY29Nbm1IMDlwZkZSbjNBb3E1ZlFGZWhlZzdYUmZQMzgraGZzWHFoT0FSdGtuckc0ei9DVmFGME9rbmFRVFYKUlRqMVU5R1JweXpRT0htdVNqZG1Oa3c0eHBrQ1lRRGRXejZsRXRQZnMwOUVwZVcxSnJPaTU0dUs3MENsSkZZYgpkZWtRb0llZWhSQ0hXU2RLVnFNODArTUJvblVHa2QyRVczM2dieEtzSEo4dzRteDBiZDNTenZzSWh1blVRK2lUCjlFVGtxdzhTc1RCZnhya1ZMN1plTC9OeGhiNWxvK1VDWVFEVzlMTkZYMEFIcldKeGRMd0hVd0NxTFFXWW55WEsKaUc3UkxPUWlRVHN3OFVLUFpqVHVzaVE3WEU2Y04ya20zME9qeS9JS0JVdGR2amxqc1FyU3lmdE12dHR4ZmNIVApMa2dydHJQd2J4VTJVYjlZL0NRdVBoMXRFNld4VEQxSFRVc0NZUURQNTAxMVdiT3FYZzNMbWsyZjBWUFRZOHFLCm1hQ0wrdzd0QjlmNWgrMFpGRDJzQWk2SEFjeWI2eDlCZjhhT2Z4NGhuSlVqNE84V3ZHTkFWTW9zcUt3NXZiSEcKRm9FMG52dXBTem9SMUNCNkcvWWxYczZqZVlhOS9DZVlybGRmdTRrQ1lBa2J1MUR3TlUxZCtuTG1TR1ZqRGY4bwpBem14WEsrVlVtVElxeTRNWjQ2dVdteXJId2tTUVZqR2s0b3BDdXFid1VqNmhsb0lXV1l5ZmtvTUlYSkhIci9rCnduV3ZwM3ZrVlNpTkNGaml6QnBPSW5hSjBKcXBCU1F2RmZGS1VycG51d0pnYjUzaWZBWEJPeW1OOEpwYmliaDYKRkZOOXE1aTZoZlNIQ0N6b1k5bXpKdUtNSEY3ZGRhMElpQXdQMTQ2QnZnT1Z2ZzQ4TnhCclBTYXlweS9PUm11OApyeC9GZS9mWUhUK3M5bStaSEo1OXlrR3BEOVJpQzh4VmtiSGhxWmhIdkVETgotLS0tLUVORCBSU0EgUFJJVkFURSBLRVktLS0tLQo*3d*22*7d'))
  };

  document.getElementById('add-button').onclick = (ev) => {
    console.debug('Pressed Add Button');
    selectedProviderPromise = providers.addProvider(token).catch(console.error);
  };
  document.getElementById('start-button').onclick = (ev) => {
    console.debug('Pressed Start Button');
    selectedProviderPromise.then((provider) => {
      return provider.startProxy();
    }).then((endpoint) => {
      console.log('Endpoint: ', endpoint);
    }).catch(console.error);
  };
  document.getElementById('stop-button').onclick = (ev) => {
    console.debug('Pressed Stop Button');
    selectedProviderPromise.then((provider) => {
      return provider.stopProxy();
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
