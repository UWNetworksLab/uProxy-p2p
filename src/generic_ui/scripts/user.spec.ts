/// <reference path='../../../../third_party/typings/jasmine/jasmine.d.ts' />

import user_interface = require('./ui');
import user = require('./user');
import social = require('../../interfaces/social');
import _ = require('lodash');

describe('UI.User', () => {
  var sampleUser :user.User;
  var ui :user_interface.UserInterface;

  beforeEach(() => {
    spyOn(console, 'log');
    ui = jasmine.createSpyObj<user_interface.UserInterface>('UserInterface', ['showNotification']);
    var testNetwork :user_interface.Network = {name: 'testNetwork', userId: 'localUserId', roster: {}, logoutExpected: false};
    ui.model = new user_interface.Model();
    ui.model.onlineNetworks = [testNetwork];

    sampleUser = new user.User('fakeuser', testNetwork, ui);
    sampleUser.update(makeUpdateMessage({}));
  });

  // TODO: rename to getInstanceData?
  function getInstance(id :string, description :string) :social.InstanceData {
    return {
      instanceId: id,
      description: description,
      localSharingWithRemote: social.SharingState.NONE,
      localGettingFromRemote: social.GettingState.NONE,
      isOnline: true,
      bytesSent: 0,
      bytesReceived: 0
    };
  }

  // adds any missing fields to an object to make it a valid update message
  function makeUpdateMessage(update :Object) {
    var result :social.UserData = <social.UserData>update;

    _.defaults(result, {
      network: 'testNetwork',
      user: {
        userId: 'fakeuser',
        name: 'fakename',
        imageData: 'fakeimage.uri',
        timestamp: Date.now()
      },
      offeringInstances: [],
      gettingInstanceIds: [],
      allInstanceIds: [],
      isOnline: true,
      consent: {
        localGrantsAccessToRemote: false,
        localRequestsAccessFromRemote: false,
        remoteRequestsAccessFromLocal: false,
        ignoringRemoteUserRequest: false,
        ignoringRemoteUserOffer: false
      }
    });

    return result;
  }

  it('check default state', () => {
    expect(sampleUser.userId).toEqual('fakeuser');
    expect(sampleUser.offeringInstances).toEqual([]);
    expect(sampleUser.allInstanceIds).toEqual([]);
    expect(sampleUser.name).toEqual('fakename');
    expect(sampleUser.imageData).toEqual('fakeimage.uri');
  });

  it('does not change description if only 1 instance', () => {
    sampleUser.update(makeUpdateMessage({
      allInstanceIds: [
        'instance1'
      ],
      offeringInstances: [
        getInstance('instance1', '')
      ]
    }));
    expect(sampleUser.offeringInstances[0].description).toEqual('');
  });

  it('updates empty descriptions when multiple instances', () => {
    sampleUser.update(makeUpdateMessage({
      allInstanceIds: [
        'instance1',
        'instance2',
        'instance3'
      ],
      offeringInstances: [
        getInstance('instance1', ''),
        getInstance('instance2', 'laptop'),
        getInstance('instance3', '')
      ]
    }));
    expect(sampleUser.offeringInstances[0].description).toEqual('Computer 1');
    expect(sampleUser.offeringInstances[1].description).toEqual('laptop');
    expect(sampleUser.offeringInstances[2].description).toEqual('Computer 3');
  });

  it('show notification if isOffering changes when not ignoring', () => {
    sampleUser.update(makeUpdateMessage({
      allInstanceIds: [
        'instance1'
      ],
      offeringInstances: [
        getInstance('instance1', '')
      ]
    }));

    expect(ui.showNotification).toHaveBeenCalledWith(
        sampleUser.name + ' offered you access', { mode: 'get', user: 'fakeuser', network: 'testNetwork' })
  });

  it('does not show notification if isOffering changes when ignoring', () => {
    sampleUser.update(makeUpdateMessage({
      consent: {
        localGrantsAccessToRemote: false,
        localRequestsAccessFromRemote: false,
        remoteRequestsAccessFromLocal: false,
        ignoringRemoteUserRequest: false,
        ignoringRemoteUserOffer: true
      },
      allInstanceIds: [
        'instance1'
      ],
      offeringInstances: [
        getInstance('instance1', '')
      ]
    }));
    expect(ui.showNotification).not.toHaveBeenCalled();
  });

  it('shows notificaion if isRequesting changes when not ignoring', () => {
    sampleUser.update(makeUpdateMessage({
      consent: {
        localGrantsAccessToRemote: false,
        localRequestsAccessFromRemote: false,
        remoteRequestsAccessFromLocal: true,
        ignoringRemoteUserRequest: false,
        ignoringRemoteUserOffer: false
      }
    }));
    expect(ui.showNotification).toHaveBeenCalledWith(
        sampleUser.name + ' is requesting access', { mode: 'share', user: 'fakeuser', network: 'testNetwork' });
  });

  it('does not show notificaion if isRequesting changes when ignoring', () => {
    sampleUser.update(makeUpdateMessage({
      consent: {
        localGrantsAccessToRemote: false,
        localRequestsAccessFromRemote: false,
        remoteRequestsAccessFromLocal: true,
        ignoringRemoteUserRequest: true,
        ignoringRemoteUserOffer: false
      }
    }));
    expect(ui.showNotification).not.toHaveBeenCalled();
  });

  it('does not replace instances', () => {
    sampleUser.update(makeUpdateMessage({
      allInstanceIds: [
        '1',
        '2'
      ],
      offeringInstances: [
        getInstance('1', ''),
        getInstance('2', '')
      ]
    }));

    var second = sampleUser.offeringInstances[1];
    expect(second.instanceId).toEqual('2');

    sampleUser.update(makeUpdateMessage({
      allInstanceIds: [
        '2'
      ],
      offeringInstances: [
        getInstance('2', '')
      ]
    }));

    expect(sampleUser.offeringInstances[0]).toBe(second);
  });

  // TODO: more specs
});  // UI.User
