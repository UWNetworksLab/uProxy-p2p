/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />
/// <reference path='remote-instance.ts' />

describe('Core.RemoteInstance', () => {

  // Prepare a fake Social.Network object to construct User on top of.
  var network = jasmine.createSpyObj('network', [
      'api',
      'sendInstanceHandshake'
  ]);
  var instance :Core.RemoteInstance;

  it('constructs from a received Instance Handshake', () => {

    var handshake :Instance = {
      instanceId: 'fakeinstance',
      keyHash:    'fakehash',
      trust: {
        asClient: 'nope',
        asProxy: 'nope'
      },
      description: 'totally fake',
      notify: false
    }
    instance = new Core.RemoteInstance(network, handshake);
    expect(instance.instanceId).toEqual('fakeinstance');
  });

  it('sends consent message for a pre-existing instance', (done) => {
    // spyOn(Core, 'sendConsent');
    // Core.receiveInstance(instanceMsg).then(() => {
      // var fakeInstance = state.instances['12345'];
      // expect(Core.sendConsent).toHaveBeenCalledWith(fakeInstance);
    // }).then(done);
    done();
  });

  it('sends updates with an Instance Handshake', () => {
  });

});

