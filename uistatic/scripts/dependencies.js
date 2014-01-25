if (undefined !== UI) {
    console.error('ui.ts already included.');
}

var UI = (function () {
    function UI(notifier, core) {
        var _this = this;
        this.notifier = notifier;
        this.networks = ['google', 'facebook', 'xmpp'];
        this.notifications = 0;
        this.accessView = false;
        this.splashPage = false;
        this.advancedOptions = false;
        this.searchBar = true;
        this.search = '';
        this.chatView = false;
        this.numClients = 0;
        this.myName = '';
        this.myPic = null;
        this.pendingProxyTrustChange = false;
        this.pendingClientTrustChange = false;
        this.isProxying = false;
        this.accessIds = 0;
        this.isConnected = false;
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
        this.notify = notifier;
        this.core = core;
        core.onConnected = function () {
            _this.isConnected = true;
        };
        core.onDisconnected = function () {
            _this.isConnected = false;
        };
    }
    UI.prototype.refreshDOM = function () {
        onStateChange.dispatch();
    };

    UI.prototype.setClients = function (numClients) {
        this.numClients = numClients;
        if (numClients > 0) {
            this.notify.setColor('#008');
            this.notify.setLabel('↓');
        } else {
            this.notify.setColor('#800');
        }
    };

    UI.prototype.modifyConsent = function (id, action) {
        if (!this.core) {
            console.log('UI not connected to core - cannot modify consent.');
            return;
        }
        this.core.modifyConsent(id, action);
    };

    UI.prototype.startProxying = function (instance) {
        this.core.start(instance.instanceId);
        this.proxy = instance;
        this._setProxying(true);
    };

    UI.prototype.stopProxying = function () {
        if (!this.instance) {
            console.warn('Stop Proxying called while not proxying.');
            return;
        }
        this._setProxying(false);
        this.core.stop(this.instance.instanceId);
    };

    UI.prototype._setProxying = function (isProxying) {
        this.isProxying = isProxying;
        if (isProxying) {
            this.notify.setIcon('uproxy-19-p.png');
        } else {
            this.notify.setIcon('uproxy-19.png');
        }
    };

    UI.prototype.login = function (network) {
        this.core.login(network);
        this.splashPage = false;
    };

    UI.prototype.logout = function (network) {
        this.core.logout(network);
        this.proxy = null;
    };

    UI.prototype.updateDescription = function (description) {
        if (this.oldDescription && (this.oldDescription != description)) {
            this.core.updateDescription(description);
        }
        this.oldDescription = description;
    };

    UI.prototype.sendInstance = function (clientId) {
        this.core.sendInstance(clientId);
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
        this.notify.setLabel(n > 0 ? n : '');
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

    UI.prototype.syncInstance = function (instance) {
    };
    UI.prototype.updateMappings = function () {
    };

    UI.prototype.updateIdentity = function (identity) {
    };
    UI.prototype.sendConsent = function () {
    };
    UI.prototype.addNotification = function () {
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

    UI.prototype.sync = function (previousPatch) {
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
console.log('This is not a real uProxy frontend.');


var model = state || { identityStatus: {} };

var MockNotifications = (function () {
    function MockNotifications() {
    }
    MockNotifications.prototype.setIcon = function (iconFile) {
        console.log('setting icon to ' + iconFile);
    };
    MockNotifications.prototype.setLabel = function (text) {
        console.log('setting label to: ' + text);
    };
    MockNotifications.prototype.setColor = function (color) {
        console.log('setting background color of the badge to: ' + color);
    };
    return MockNotifications;
})();

var MockCore = (function () {
    function MockCore() {
    }
    MockCore.prototype.constuctor = function () {
    };
    MockCore.prototype.onConnected = function () {
        console.log('Fake onConnected! :D');
    };
    MockCore.prototype.onDisconnected = function () {
        console.log('Fake onConnected! :D');
    };
    MockCore.prototype.reset = function () {
        console.log('Resetting.');
    };
    MockCore.prototype.sendInstance = function (clientId) {
        console.log('Sending instance ID to ' + clientId);
    };
    MockCore.prototype.modifyConsent = function (instanceId, action) {
        console.log('Modifying consent.');
    };
    MockCore.prototype.start = function (instanceId) {
        console.log('Starting to proxy through ' + instanceId);
    };
    MockCore.prototype.stop = function (instanceId) {
        console.log('Stopping proxy through ' + instanceId);
    };
    MockCore.prototype.updateDescription = function (description) {
        console.log('Updating description to ' + description);
    };
    MockCore.prototype.changeOption = function (option) {
        console.log('Changing option ' + option);
    };
    MockCore.prototype.login = function (network) {
        console.log('Logging in to', network);
    };
    MockCore.prototype.logout = function (network) {
        console.log('Logging out of', network);
    };
    return MockCore;
})();

var mockCore = new MockCore();
var ui = new UI(new MockNotifications(), mockCore);
mockCore.onConnected();

var dependencyInjector = angular.module('dependencyInjector', []).filter('i18n', function () {
    return function (key) {
        return key;
    };
}).constant('appChannel', {
    status: {
        connected: true
    },
    emit: function (name, args) {
        console.log('appChannel.emit("' + name + '",', args);
        ui.sync();
    }
}).constant('onStateChange', null).constant('ui', ui).constant('model', model).constant('roster', null);
