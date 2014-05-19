/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />
/// <reference path='local-instance.ts' />

describe('Core.LocalInstance', () => {

  var instance :Core.LocalInstance;
  var network = <Social.Network><any>jasmine.createSpy('network');

  beforeEach(() => {
    spyOn(console, 'log');
    spyOn(console, 'warn');
  });

  it('initializes with valid id, description, and keyhash', () => {
    instance = new Core.LocalInstance(network);
    expect(instance.instanceId).toBeDefined();
    expect(instance.description).toBeDefined();
    expect(instance.keyHash).toBeDefined();
  });

  it('provides an instance handshake', () => {
    var id = instance['instanceId'];
    var handshake = instance.getInstanceHandshake();
    expect(handshake.instanceId).toEqual(id);
  });

  // TODO: more specs.

});
