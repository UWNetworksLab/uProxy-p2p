/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />
/// <reference path='social.ts' />

function MockSocial() {}
MockSocial.prototype.on = function() {}
MockSocial.prototype.emit = function() {}
MockSocial.prototype.manifest = {};

describe('Social.Network', () => {

  var network :Social.Network;
  // Mock social providers.
  freedom['SOCIAL-badmock'] = () => { return new MockSocial(); };
  freedom['SOCIAL-mock'] = () => { return new MockSocial(); };
  freedom['SOCIAL-mock']['api'] = 'social';

  it('fails to initialize if api is not social', () => {
    spyOn(console, 'warn');
    Social.initializeNetworks(['badmock']);
    expect(console.warn).toHaveBeenCalled();
  });

  it('successfully initializes if api is social', () => {
    Social.initializeNetworks(['mock']);
    network = Social.getNetwork('mock');
    expect(network.name).toEqual('mock');
  });

  it('begins with empty roster', () => {
    expect(network.roster).toEqual({});
  });

  it('adds a new user', () => {
    expect(Object.keys(network.roster).length).toEqual(0);
    network.handleUserProfile({
      userId: 'mockuser',
      name: 'mock1',
      timestamp: Date.now()
    });
    expect(Object.keys(network.roster).length).toEqual(1);
    var user = network.getUser('mockuser');
    expect(user).toBeDefined;
    expect(user.name).toEqual('mock1');
  });

  it('updates existing user', () => {
    expect(Object.keys(network.roster).length).toEqual(1);
    var user = network.getUser('mockuser');
    spyOn(user, 'update').and.callThrough();
    network.handleUserProfile({
      userId: 'mockuser',
      name: 'newname',
      timestamp: Date.now()
    });
    expect(user.update).toHaveBeenCalled();
    expect(user).toBeDefined;
    expect(user.name).toEqual('newname');
  });

  it('passes onClientState to correct client', () => {
    var user = network.getUser('mockuser');
    spyOn(user, 'handleClient');
    var clientState :freedom.Social.ClientState = {
      userId: 'mockuser',
      clientId: 'fakeclient',
      status: freedom.Social.Status.ONLINE,
      timestamp: 12345
    };
    network.handleClientState(clientState);
    expect(user.handleClient).toHaveBeenCalledWith(clientState);
  });

  it('warns if receiving ClientState with userId not in roster', () => {
    var user = network.getUser('mockuser');
    spyOn(console, 'warn');
    spyOn(user, 'handleClient');
    var clientState :freedom.Social.ClientState = {
      userId: 'im_not_here',
      clientId: 'fakeclient',
      status: freedom.Social.Status.ONLINE,
      timestamp: 12345
    };
    network.handleClientState(clientState);
    expect(user.handleClient).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it('passes onMessage to correct client', () => {
    var user = network.getUser('mockuser');
    spyOn(user, 'handleMessage');
    var msg = {
      from: {
        userId: 'mockuser',
        clientId: 'fakeclient',
        status: freedom.Social.Status.ONLINE,
        timestamp: 12345
      },
      message: null
    };
    network.handleMessage(msg);
    expect(user.handleMessage).toHaveBeenCalledWith(msg);
  });

  it('warns if receiving Message with userId not in roster', () => {
    var user = network.getUser('mockuser');
    spyOn(console, 'warn');
    spyOn(user, 'handleMessage');
    var msg = {
      from: {
        userId: 'im_not_here',
        clientId: 'fakeclient',
        status: freedom.Social.Status.ONLINE,
        timestamp: 12345
      },
      message: null
    };
    network.handleMessage(msg);
    expect(user.handleMessage).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

});
