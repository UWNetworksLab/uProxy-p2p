import * as freedomMocker from '../lib/freedom/mocks/mock-freedom-in-module-env';
import mockFreedomRtcPeerConnection from '../lib/freedom/mocks/mock-rtcpeerconnection';

import * as freedom_mocks from '../mocks/freedom-mocks';
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv({
    'core.storage': () => { return new freedom_mocks.MockFreedomStorage(); },
    'loggingcontroller': () => { return new freedom_mocks.MockLoggingController(); },
    'metrics': () => { return new freedom_mocks.MockMetrics(); },
    'core.tcpsocket': () => { return new freedom_mocks.MockTcpSocket(); },
    'core.rtcpeerconnection': () => { return new mockFreedomRtcPeerConnection(); },
    'pgp': () => { return new freedom_mocks.PgpProvider() },
    'portControl': () => { return new Object }
});


import * as local_instance from './local-instance';
import * as social from '../interfaces/social';

describe('local_instance.LocalInstance', () => {

  var instance :local_instance.LocalInstance;
  var network = <social.Network><any>jasmine.createSpy('network');

  beforeEach(() => {
    spyOn(console, 'log');
  });

  it('initializes with valid id and keyhash', () => {
    instance = new local_instance.LocalInstance(network, 'fakeId');
    expect(instance.instanceId).toBeDefined();
  });

  // TODO: more specs.

});
