/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />
/// <reference path='user.ts' />

describe('Core.User', () => {


  var profile :freedom.Social.UserProfile = {
    name: 'Alice',
    userId: 'abc',
    timestamp: 456
  };
  var user = new Core.User(profile);

  it('creates with the correct userId', () => {
    expect(user.userId).toEqual('abc');
    expect(user.name).toEqual('Alice');
  });

  it('created with an empty clientId list', () => {
    expect(user['clientToInstanceMap_']).toEqual({});
  });

  it('handles onClientState event for disconnection', () => {
    var clientState :freedom.Social.ClientState = {
      userId: 'abc',
      clientId: 'def',
      status: uProxy.Status.ONLINE,
      timestamp: 12345
    };
    user.handleClientState(clientState);
    expect(Object.keys(user.clients)).toEqual([
      'def'
    ]);
  });

});  // uProxy.User
