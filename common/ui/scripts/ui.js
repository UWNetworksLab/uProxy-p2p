'use strict';
if (undefined !== UI) {
    console.log('ui.ts already included.');
    return false;
}

var UI = (function () {
    function UI(browserType) {
        this.ICON_DIR = '../common/ui/icons/';
        this.networks = ['google', 'facebook', 'xmpp'];
        this.notifications = 0;
        this.accessView = false;
        this.splashPage = false;
        this.advancedOptions = false;
        this.searchBar = true;
        this.search = '';
        this.pendingProxyTrustChange = false;
        this.pendingClientTrustChange = false;
        this.chatView = false;
        this.numClients = 0;
        this.myName = '';
        this.myPic = null;
        this.isProxying = false;
        this.accessIds = 0;
        this.contact = null;
        this.contactUnwatch = null;
        this.instance = null;
        this.instanceUnwatch = null;
        this.proxy = null;
        this.oldDescription = '';
        this.filters = {
            'online': true,
            'myAccess': false,
            'friendsAccess': false,
            'uproxy': false
        };
    }
    UI.prototype.setIcon = function (iconFile) {
        chrome.browserAction.setIcon({
            path: this.ICON_DIR + iconFile
        });
    };

    UI.prototype.setLabel = function (text) {
        chrome.browserAction.setBadgeText({ text: '' + text });
    };

    UI.prototype.refreshDOM = function () {
        onStateChange.dispatch();
    };

    UI.prototype.setProxying = function (isProxying) {
        this.isProxying = isProxying;
        if (isProxying) {
            this.setIcon('uproxy-19-p.png');
        } else {
            this.setIcon('uproxy-19.png');
        }
    };

    UI.prototype.setClients = function (numClients) {
        this.numClients = numClients;
        if (numClients > 0) {
            chrome.browserAction.setBadgeBackgroundColor({ color: '#008' });
            this.setLabel('↓');
        } else {
            chrome.browserAction.setBadgeBackgroundColor({ color: '#800' });
        }
    };

    UI.prototype.toggleFilter = function (filter) {
        if (undefined === this.filters[filter]) {
            console.error('Filter "' + filter + '" is not a valid filter.');
            return false;
        }
        console.log('Toggling ' + filter + ' : ' + this.filters[filter]);
        this.filters[filter] = !this.filters[filter];
    };

    UI.prototype.contactIsFiltered = function (c) {
        var searchText = this.search, compareString = c.name.toLowerCase();

        if ((this.filters.online && !c.online) || (this.filters.uproxy && !c.canUProxy) || (this.filters.myAccess && !c.givesMe) || (this.filters.friendsAccess && !c.usesMe)) {
            return true;
        }

        if (!searchText) {
            return false;
        }
        if (compareString.indexOf(searchText) >= 0) {
            return false;
        }
        return true;
    };

    UI.prototype.focusOnContact = function (contact) {
        console.log('focusing on contact ' + contact);
        this.contact = contact;
        this.notificationSeen(contact);
        this.accessView = true;
    };

    UI.prototype.returnToRoster = function () {
        console.log('returning to roster! ' + this.contact);
        if (this.contact && this.contact.hasNotification) {
            console.log('sending notification seen');
            this.notificationSeen(this.contact);
            this.contact = null;
        }
        this.accessView = false;
    };

    UI.prototype.setNotifications = function (n) {
        this.setLabel(n > 0 ? n : '');
        this.notifications = n < 0 ? 0 : n;
    };

    UI.prototype.decNotifications = function () {
        this.setNotifications(this.notifications - 1);
    };

    UI.prototype.notificationSeen = function (user) {
        if (!user.hasNotification) {
            return;
        }
        appChannel.emit('notification-seen', user.userId);
        user.hasNotification = false;
        this.decNotifications();
    };

    UI.prototype.syncMe = function () {
        var id = _getMyId();
        if (!id) {
            console.log('My own identities missing for now....');
            return;
        }
        var identity = model.me.identities[id];
        this.myName = identity.name;
        this.myPic = identity.imageData || '';
        console.log('Synced my own identity. ', identity);
    };

    UI.prototype.syncUser = function (user) {
        var instanceId = null, instance = null, online = false, canUProxy = false, hasNotification = false, isActiveClient = false, isActiveProxy = false, onGoogle = false, onFB = false, onXMPP = false;

        for (var clientId in user.clients) {
            var client = user.clients[clientId];
            onGoogle = onGoogle || 'google' == client.network;
            onFB = onFB || 'facebook' == client.network;
            onXMPP = onXMPP || 'xmpp' == client.network;
            online = online || (('manual' != client.network) && ('messageable' == client.status || 'online' == client.status));

            instanceId = model.clientToInstance[clientId];
            if (!instanceId)
                continue;
            instance = model.instances[instanceId];
            if (!instance)
                continue;
            canUProxy = true;

            hasNotification = hasNotification || instance.notify;

            user.trust = instance.trust;
            user.givesMe = ('no' != user.trust.asProxy);
            user.usesMe = ('no' != user.trust.asClient);
            isActiveClient = isActiveClient || 'running' == instance.status.client;
            isActiveProxy = isActiveProxy || 'running' == instance.status.proxy;
            break;
        }

        user.online = online;
        user.canUProxy = canUProxy;
        user.hasNotification = hasNotification;
        user.isActiveClient = isActiveClient;
        user.isActiveProxy = isActiveProxy;
        user.onGoogle = onGoogle;
        user.onFB = onFB;
        user.onXMPP = onXMPP;
    };

    UI.prototype.synchronize = function (previousPatch) {
        var n = 0;
        for (var userId in model.roster) {
            var user = model.roster[userId];
            this.syncUser(user);
            if (user.hasNotification) {
                n++;
            }
        }
        this.setNotifications(n);

        var c = 0;
        for (var iId in model.instances) {
            var instance = model.instances[iId];
            if ('running' == instance.status.client) {
                c++;
            }
            if ('running' == instance.status.proxy) {
                this.isProxying = true;
            }
        }
        this.setClients(c);
        this.pendingProxyTrustChange = false;
        this.pendingClientTrustChange = false;

        if (!this.myName) {
            this.syncMe();
        }
        return true;
    };
    return UI;
})();

function _getMyId() {
    for (var id in model.me.identities) {
        return id;
    }
    return null;
}
