/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />
/// <reference path='local-instance.ts' />

describe('Core.LocalInstance', () => {

  it('initializes with valid id, description, and keyhash', () => {
    var instance = new Core.LocalInstance();
    expect(instance.instanceId).toBeDefined();
    expect(instance.description).toBeDefined();
    expect(instance.keyHash).toBeDefined();
  });

  // TODO: more specs.

});
