/// <reference path='user.ts' />
/// <reference path='../../third_party/typings/jasmine/jasmine.d.ts' />


describe('UI.User', () => {

  var user :UI.User;

  beforeEach(() => {
    spyOn(console, 'log');
    spyOn(console, 'warn');
  });

  it('creates with the correct userId', () => {
    user = new UI.User('fakeuser');
    expect(user.userId).toEqual('fakeuser');
    expect(user.instances).toBeDefined();
  });

  it('updates with a profile', () => {
    user.update({
      userId: 'fakeuser',
      name: 'fakename',
      imageData: 'fakeimage.uri',
      timestamp: Date.now(),
      isOnline: true
    });
    expect(user.name).toEqual('fakename');
    expect(user.imageData).toEqual('fakeimage.uri');
  });

  // TODO: more specs

});  // UI.User
