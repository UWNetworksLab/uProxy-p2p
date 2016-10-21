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
import uparams = require('uparams');

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

function parseInviteUrl(inviteUrl: string): social.InviteTokenData {
  let params = uparams(inviteUrl);
  if (!params || !params['networkName']) {
    return null;
  }
  var permission: any;
  if (params['permission']) {
    permission = jsurl.parse(params['permission']);
  }
  return {
    v: parseInt(params['v'], 10),
    networkData: JSON.parse(jsurl.parse(params['networkData'])),
    networkName: params['networkName'],
    userName: params['userName'],
    permission: permission,
    userId: params['userId'],  // undefined if no permission
    instanceId: params['instanceId'],  // undefined if no permission
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

  public addProvider(inviteUrl: string): Promise<AccessProvider> {
    let token = parseInviteUrl(inviteUrl);
    if (!token) {
      return Promise.reject(`Failed to parse inviteUrl ${inviteUrl}`);
    }
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

  // UI Code Below
  let addWidget = document.getElementById('add-widget') as HTMLDivElement;
  let addTokenText = document.getElementById('add-token-text') as HTMLTextAreaElement;
  let addButton = document.getElementById('add-button') as HTMLButtonElement;
  let startButton = document.getElementById('start-button') as HTMLButtonElement;
  let stopButton = document.getElementById('stop-button') as HTMLButtonElement;

  addButton.onclick = (ev) => {
    console.debug('Pressed Add Button');
    addButton.disabled = true;
    selectedProviderPromise = providers.addProvider(addTokenText.textContent);
    selectedProviderPromise.then(() => {
      startButton.disabled = false;
    }).catch((error) => {
      console.error(error);
      addButton.disabled = false;
    });
  };
  startButton.onclick = (ev) => {
    console.debug('Pressed Start Button');
    selectedProviderPromise.then((provider) => {
      startButton.disabled = true;
      return provider.startProxy();
    }).then((endpoint) => {
      console.log('Endpoint: ', endpoint);
      stopButton.disabled = false;
    }).catch((error) => {
      console.error(error);
      startButton.disabled = false;
    });
  };
  stopButton.onclick = (ev) => {
    console.debug('Pressed Stop Button');
    selectedProviderPromise.then((provider) => {
      return provider.stopProxy();
    }).then(() => {
      startButton.disabled = false;
      stopButton.disabled = true;
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
