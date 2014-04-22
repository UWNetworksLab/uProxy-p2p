/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />
/// <reference path='user.ts' />

describe('Core.User', () => {

  var profile :freedom.Social.UserProfile = {
    name: 'Alice',
    userId: 'abc',
    timestamp: 456
  };
  var user :Core.User;

  it('creates with the correct userId', () => {
    user = new Core.User(profile);
    expect(user.userId).toEqual('abc');
    expect(user.name).toEqual('Alice');
  });

  it('created with an empty clientId list', () => {
    expect(user['clientToInstanceMap_']).toEqual({});
  });

  it('handles a new ONLINE client', () => {
    var clientState :freedom.Social.ClientState = {
      userId: 'abc',
      clientId: 'def',
      status: freedom.Social.Status.ONLINE,
      timestamp: 12345
    };
    user.handleClientState(clientState);
    expect(Object.keys(user.clients).length).toEqual(1);
    expect(Object.keys(user.clients)).toEqual([
      'def'
    ]);
    expect(user.clients['def']).toEqual(freedom.Social.Status.ONLINE);
  });

  it('handles DISCONNECTED client', () => {
    var clientState :freedom.Social.ClientState = {
      userId: 'abc',
      clientId: 'def',
      status: freedom.Social.Status.OFFLINE,
      timestamp: 12346
    };
    user.handleClientState(clientState);
    expect(Object.keys(user.clients).length).toEqual(1);
    expect(user.clients['def']).toEqual(freedom.Social.Status.OFFLINE);
  });

  it('logs an error when receiving a ClientState with wrong userId', () => {
    var clientState :freedom.Social.ClientState = {
      userId: 'abcd',
      clientId: 'def',
      status: freedom.Social.Status.ONLINE,
      timestamp: 12345
    };
    spyOn(console, 'error');
    user.handleClientState(clientState);
    expect(console.error).toHaveBeenCalled();
  });

  function makeAliceMessage(msg :uProxy.Message) :freedom.Social.IncomingMessage {
    return {
      from: {
        userId: 'abc',
        clientId: 'def',
        status: freedom.Social.Status.ONLINE,
        timestamp: 12346
      },
      message: JSON.stringify(msg)
    };
  }

  it('handles an INSTANCE message', () => {
    spyOn(user, 'handleInstance_');
    user.handleMessage(makeAliceMessage({
      type: uProxy.MessageType.INSTANCE,
      data: {
        'foo': 1
      }
    }));
    expect(user['handleInstance_']).toHaveBeenCalled();
  });

  it('handles a CONSENT message', () => {
    spyOn(user, 'handleConsent_');
    user.handleMessage(makeAliceMessage({
      type: uProxy.MessageType.CONSENT,
      data: {
        'bar': 2
      }
    }));
    expect(user['handleConsent_']).toHaveBeenCalled();
  });

  it('errors when receiving a message with invalid MessageType', () => {
    spyOn(console, 'error');
    user.handleMessage(makeAliceMessage({
      type: <uProxy.MessageType>0,
      data: {
        'baz': 3
      }
    }));
    expect(console.error).toHaveBeenCalled();
  });

  it('errors when receiving a message with wrong userId', () => {
    var msg :freedom.Social.IncomingMessage = {
      from: {
        userId: 'abcd',
        clientId: 'def',
        status: freedom.Social.Status.ONLINE,
        timestamp: 12346
      },
      message: 'hello'
    };
    spyOn(console, 'error');
    user.handleMessage(msg);
    expect(console.error).toHaveBeenCalled();
  });

});  // uProxy.User
