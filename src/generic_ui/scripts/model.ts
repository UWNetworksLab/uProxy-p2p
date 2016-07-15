/// <reference path='../../../../third_party/typings/browser.d.ts' />

import social = require('../../interfaces/social');
import ui_constants = require('../../interfaces/ui');
import uproxy_core_api = require('../../interfaces/uproxy_core_api');
import user_module = require('./user');
import User = user_module.User;
import _ = require('lodash');

export interface ContactCategory {
  [type :string] :User[];
  pending :User[];
  trustedUproxy :User[];
  untrustedUproxy :User[];
}

export interface Contacts {
  getAccessContacts :ContactCategory;
  shareAccessContacts :ContactCategory;
}

/**
 * Specific to one particular Social network.
 */
export interface Network {
  name :string;
  // TODO(salomegeo): Add more information about the user.
  userId :string;
  imageData ?:string;
  userName ?:string;
  logoutExpected: boolean;
  roster :{ [userId:string] :User };
}

export class Model {
  public networkNames :string[] = [];
  public cloudProviderNames :string[] = [];

  public onlineNetworks :Network[] = [];

  public contacts :Contacts = {
    getAccessContacts: {
      pending: [],
      trustedUproxy: [],
      untrustedUproxy: [],
    },
    shareAccessContacts: {
      pending: [],
      trustedUproxy: [],
      untrustedUproxy: [],
    }
  };

  public globalSettings :uproxy_core_api.GlobalSettings = {
    version: 0,
    description: '',
    stunServers: [],
    hasSeenSharingEnabledScreen: false,
    hasSeenWelcome: false,
    hasSeenMetrics: false,
    mode : ui_constants.Mode.GET,
    allowNonUnicast: false,
    statsReportingEnabled: false,
    consoleFilter: 0,
    language: null,  // sentinel indicating lang should be calculated from browser settings
    force_message_version: 0,
    quiverUserName: '',
    showCloud: false,
    proxyBypass: [],
    enforceProxyServerValidity: false,
    validProxyServers: [],
    activePromoId: null,
    enabledExperiments: [],
    shouldHijackDO: true,
    crypto: true
  };

  public reconnecting = false;

  // userId is included as an optional parameter because we will eventually
  // want to use it to get an accurate network.  For now, it is ignored and
  // serves to remind us of where we still need to add the info
  public getNetwork = (networkName :string, userId?:string) :Network => {
    return _.find(this.onlineNetworks, { name: networkName });
  }

  public removeNetwork = (networkName :string, userId :string) => {
    var network = this.getNetwork(networkName, userId);

    for (var otherUserId in network.roster) {
      var user = this.getUser(network, otherUserId);
      var userCategories = user.getCategories();
      categorizeUser(user, this.contacts.getAccessContacts,
                     userCategories.getTab, null);
      categorizeUser(user, this.contacts.shareAccessContacts,
                     userCategories.shareTab, null);
    }

    _.remove(this.onlineNetworks, { name: networkName });
  }

  public getUser = (network :Network, userId :string) :User => {
    if (network.roster[userId]) {
      return network.roster[userId];
    }

    return null;
  }

  public removeContact = (user :User) : void => {
    var userCategories = user.getCategories();
    // Remove user from its getTab category
    categorizeUser(user, this.contacts.getAccessContacts,
      userCategories.getTab, null);
    // Remove user from its shareTab category
    categorizeUser(user, this.contacts.shareAccessContacts,
      userCategories.shareTab, null);
  }

  public updateGlobalSettings = (settings: Object) => {
    _.merge(this.globalSettings, settings, (a :any, b :any) => {
      if (_.isArray(a) && _.isArray(b)) {
        return b;
      }
      return undefined;
    });
  }
}

export function categorizeUser(user :User, contacts :ContactCategory, oldCategory :string, newCategory :string) {
  if (oldCategory === newCategory) {
    // no need to do any work if nothing changed
    return;
  }

  if (oldCategory) {
    // remove user from old category
    var oldCategoryArray = contacts[oldCategory];
    for (var i = 0; i < oldCategoryArray.length; ++i) {
      if (oldCategoryArray[i] == user) {
        oldCategoryArray.splice(i, 1);
        break;
      }
    }
  }

  if (newCategory) {
    // add user to new category
    contacts[newCategory].push(user);
    if (user.status == social.UserStatus.LOCAL_INVITED_BY_REMOTE) {
      user.getExpanded = true;
      user.shareExpanded = true;
    }
  }
}
