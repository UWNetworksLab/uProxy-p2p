/// <reference path='../../../third_party/typings/index.d.ts' />

import * as model from './model';
import * as user_interface from './ui';
import * as translator from './translator';
import * as user from './user';
import * as social from '../../interfaces/social';
import * as _ from 'lodash';

describe('UI.User', () => {
  var sampleUser :user.User;
  var ui :user_interface.UserInterface;

  beforeEach(() => {
    spyOn(console, 'log');
    ui = jasmine.createSpyObj<user_interface.UserInterface>('UserInterface', ['showNotification']);
    var testNetwork :model.Network = {name: 'testNetwork', userId: 'localUserId', roster: {}, logoutExpected: false};
    ui.model = new model.Model();
    ui.model.onlineNetworks = [testNetwork];
    ui.i18n_t = translator.i18n_t;

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
      bytesReceived: 0,
      activeEndpoint: null,
      verifyState: social.VerifyState.VERIFY_NONE,
      verifySAS: null,
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

  it('update does not change its argument', () => {
    let m1 = makeUpdateMessage({
      allInstanceIds: [
        'instance1'
      ],
      offeringInstances: [
        getInstance('instance1', '')
      ]
    });
    let m2 = JSON.parse(JSON.stringify(m1));
    expect(m1).toEqual(m2);
    sampleUser.update(m1);
    // Regression test: passing the same input twice would previously
    // cause instances to be removed because they are already known.
    sampleUser.update(m1);
    expect(m1).toEqual(m2);
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
    expect(sampleUser.offeringInstances[0].description).toEqual(
        ui.i18n_t('DESCRIPTION_DEFAULT', { number: 1 }));
    expect(sampleUser.offeringInstances[1].description).toEqual('laptop');
    expect(sampleUser.offeringInstances[2].description).toEqual(
        ui.i18n_t('DESCRIPTION_DEFAULT', { number: 3 }));
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
        ui.i18n_t('OFFERED_ACCESS_NOTIFICATION', { name: sampleUser.name }),
        { mode: 'get', user: 'fakeuser', network: 'testNetwork' })
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
        ui.i18n_t('REQUESTING_ACCESS_NOTIFICATION', { name: sampleUser.name }),
        { mode: 'share', user: 'fakeuser', network: 'testNetwork' });
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

  it('expands contact if online', () => {
    sampleUser.update(makeUpdateMessage({
      offeringInstances: [
        getInstance('instance1', '')
      ],
      consent: {
        remoteRequestsAccessFromLocal: true
      },
      isOnline: true,
    }));
    expect(sampleUser.getExpanded).toBe(true);
    expect(sampleUser.shareExpanded).toBe(true);
  });

  it('collapses contact if offline', () => {
    sampleUser.update(makeUpdateMessage({
      offeringInstances: [
        getInstance('instance1', '')
      ],
      consent: {
        remoteRequestsAccessFromLocal: true
      },
      isOnline: false,
    }));
    expect(sampleUser.getExpanded).toBe(false);
    expect(sampleUser.shareExpanded).toBe(false);
  });
  // TODO: more specs
});  // UI.User
