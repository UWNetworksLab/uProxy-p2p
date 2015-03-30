/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='local-instance.ts' />

describe('Core.LocalInstance', () => {

  var instance :Core.LocalInstance;
  var network = <Social.Network><any>jasmine.createSpy('network');

  beforeEach(() => {
    spyOn(console, 'log');
  });

  it('initializes with valid id and keyhash', () => {
    instance = new Core.LocalInstance(network, 'fakeId');
    expect(instance.instanceId).toBeDefined();
    expect(instance.keyHash).toBeDefined();
  });

  // TODO: more specs.

});
