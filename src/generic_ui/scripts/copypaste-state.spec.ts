/// <reference path='../../../../third_party/typings/jasmine/jasmine.d.ts' />

import CopyPasteState = require('./copypaste-state');
import social = require('../../interfaces/social');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');

describe('CopyPasteState', () => {
  it('correctly handles update', () => {
    var state = new CopyPasteState();

    var update :uproxy_core_api.ConnectionState = {
      localGettingFromRemote: social.GettingState.TRYING_TO_GET_ACCESS,
      localSharingWithRemote: social.SharingState.SHARING_ACCESS,
      bytesSent: 1,
      bytesReceived: 2,
      activeEndpoint: null,
    };

    state.updateFromConnectionState(update);

    expect(state.localGettingFromRemote).toEqual(update.localGettingFromRemote);
    expect(state.localSharingWithRemote).toEqual(update.localSharingWithRemote);
  });
});
