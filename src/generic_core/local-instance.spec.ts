/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path='local-instance.ts' />

describe('local_instance.LocalInstance', () => {

  var instance :local_instance.LocalInstance;
  var network = <Social.Network><any>jasmine.createSpy('network');

  beforeEach(() => {
    spyOn(console, 'log');
  });

  it('initializes with valid id and keyhash', () => {
    instance = new local_instance.LocalInstance(network, 'fakeId');
    expect(instance.instanceId).toBeDefined();
    expect(instance.keyHash).toBeDefined();
  });

  // TODO: more specs.

});
