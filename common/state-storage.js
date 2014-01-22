var C = Constants;

function UProxyState() {
    this.storage = freedom.storage();
    this.state = cloneDeep(C.DEFAULT_LOAD_STATE);
}

UProxyState.prototype.reset = function (callback) {
    this.storage.clear().done(function () {
        console.log("Cleared storage, now loading again...");
        this.state = cloneDeep(DEFAULT_LOAD_STATE);
        this.loadStateFromStorage(callback);
    }.bind(this));
};

UProxyState.prototype._loadKeyAsJson = function (key, callback, defaultIfUndefined) {
    this.storage.get(key).done(function (result) {
        console.log("Loaded from storage[" + key + "] (type: " + (typeof result) + "): " + result);
        if (isDefined(result)) {
            callback(JSON.parse(result));
        } else {
            callback(defaultIfUndefined);
        }
    });
};

UProxyState.prototype._saveKeyAsJson = function (key, val, callback) {
    this.storage.set(key, JSON.stringify(val)).done(callback);
};

UProxyState.prototype._generateMyInstance = function () {
    var i, val, hex, id, key;

    var me = cloneDeep(DEFAULT_LOAD_STATE.me);

    for (i = 0; i < 20; i++) {
        val = Math.floor(Math.random() * 256);
        hex = val.toString(16);
        me.instanceId = me.instanceId + ('00'.substr(0, 2 - hex.length) + hex);

        val = Math.floor(Math.random() * 256);
        hex = val.toString(16);

        me.keyHash = ((i > 0) ? (me.keyHash + ':') : '') + ('00'.substr(0, 2 - hex.length) + hex);

        if (i < 4) {
            id = (i & 1) ? nouns[val] : adjectives[val];
            if (me.description !== null && me.description.length > 0) {
                me.description = me.description + " " + id;
            } else {
                me.description = id;
            }
        }
    }

    return me;
};

UProxyState.prototype.isMessageableUproxyClient = function (client) {
    return 'messageable' == client.status;
};

UProxyState.prototype.saveMeToStorage = function (callback) {
    this._saveKeyAsJson(StateEntries.ME, restrictKeys(DEFAULT_SAVE_STATE.me, this.state.me), callback);
};

UProxyState.prototype.loadMeFromStorage = function (callback) {
    this._loadKeyAsJson(StateEntries.ME, function (me) {
        if (null === me) {
            this.state.me = this._generateMyInstance();
            this.saveMeToStorage(callback);
            console.log("****** Saving new self-definition *****");
            console.log("  state.me = " + JSON.stringify(this.state.me));
        } else {
            console.log("++++++ Loaded self-definition ++++++");
            console.log("  state.me = " + JSON.stringify(me));
            this.state.me = restrictKeys(this.state.me, me);
            if (callback) {
                callback();
            }
        }
    }.bind(this), null);
};

UProxyState.prototype.saveOptionsToStorage = function (callback) {
    this._saveKeyAsJson(StateEntries.OPTIONS, restrictKeys(DEFAULT_SAVE_STATE.options, this.state.options), callback);
};

UProxyState.prototype.loadOptionsFromStorage = function (callback) {
    this._loadKeyAsJson(StateEntries.OPTIONS, function (loadedOptions) {
        this.state.options = restrictKeys(cloneDeep(DEFAULT_LOAD_STATE.options), loadedOptions);
        if (callback) {
            callback();
        }
    }.bind(this), {});
};

UProxyState.prototype.instanceOfUserId = function (userId) {
    for (var i in this.state.instances) {
        if (this.state.instances[i].rosterInfo.userId == userId)
            return this.state.instances[i];
    }
    return null;
};

UProxyState.prototype.syncRosterFromInstanceId = function (instanceId) {
    var instance = this.state.instances[instanceId];
    var userId = instance.rosterInfo.userId;
    var user = this.state.roster[userId];

    if (!user) {
        this.state.roster[userId] = {};
        user = this.state.roster[userId];
        user.clients = {};
        user.userId = userId;
        user.name = instance.rosterInfo.name;
        user.network = instance.rosterInfo.network;
        user.url = instance.rosterInfo.url;
        user.hasNotification = Boolean(instance.notify);
    }
};

UProxyState.prototype.syncInstanceFromInstanceMessage = function (userId, clientId, data) {
    var instanceId = data.instanceId;

    data = restrictKeys(DEFAULT_INSTANCE, data);

    var oldClientId = this.state.instanceToClient[instanceId];
    this.state.clientToInstance[clientId] = instanceId;
    this.state.instanceToClient[instanceId] = clientId;

    if (oldClientId && (oldClientId != clientId)) {
        console.log('Deleting obsolete client ' + oldClientId);
        var user = this.state.roster[userId];
        if (user) {
            delete user.clients[oldClientId];
        } else {
            console.error('Warning: no user for ' + userId);
        }
        delete this.state.clientToInstance[oldClientId];
    }

    var instance = this.state.instances[instanceId];
    if (!instance) {
        console.log('Preparing NEW Instance... ');
        instance = cloneDeep(DEFAULT_INSTANCE);
        instance.instanceId = data.instanceId;
        instance.keyHash = data.keyHash;
        this.state.instances[instanceId] = instance;
    }
    instance.rosterInfo = data.rosterInfo;
    instance.rosterInfo.userId = userId;
    instance.description = data.description;

    this.syncRosterFromInstanceId(instanceId);
};

UProxyState.prototype.loadInstanceFromId = function (instanceId, callback) {
    this._loadKeyAsJson('instance/' + instanceId, function (instance) {
        if (!instance) {
            console.error('Load error: instance ' + instanceId + ' not found');
        } else {
            console.log('instance ' + instanceId + ' loaded');
            instance.status = cloneDeep(DEFAULT_PROXY_STATUS);
            this.state.instances[instanceId] = instance;
            this.syncRosterFromInstanceId(instanceId);
        }
        if (callback) {
            callback();
        }
    }.bind(this), null);
};

UProxyState.prototype.loadAllInstances = function (callback) {
    var finalCallbacker = new FinalCallback(callback);

    this._loadKeyAsJson(StateEntries.INSTANCEIDS, function (instanceIds) {
        console.log('Loading Instance IDs: ', instanceIds);
        for (var i = 0; i < instanceIds.length; i++) {
            this.loadInstanceFromId(instanceIds[i], finalCallbacker.makeCountedCallback());
        }
    }.bind(this), []);

    var atLeastOneCountedCallback = finalCallbacker.makeCountedCallback();
    if (atLeastOneCountedCallback)
        atLeastOneCountedCallback();
};

UProxyState.prototype.saveInstance = function (instanceId, callback) {
    var finalCallbacker = new FinalCallback(callback);

    this._saveKeyAsJson(StateEntries.INSTANCEIDS, Object.keys(this.state[StateEntries.INSTANCES]), finalCallbacker.makeCountedCallback());

    var instance = this.state.instances[instanceId];

    var instanceDataToSave = {
        instanceId: instanceId,
        keyHash: instance.keyHash,
        trust: instance.trust,
        description: instance.description,
        notify: Boolean(instance.notify),
        rosterInfo: instance.rosterInfo
    };
    console.log('saveInstance: saving "instance/"' + instanceId + '\n', instanceDataToSave);
    this._saveKeyAsJson("instance/" + instanceId, instanceDataToSave, finalCallbacker.makeCountedCallback());
};

UProxyState.prototype.saveAllInstances = function (callback) {
    var finalCallbacker = new FinalCallback(callback);
    for (var instanceId in this.state.instances) {
        this.saveInstance(instanceId, finalCallbacker.makeCountedCallback());
    }

    this._saveKeyAsJson(StateEntries.INSTANCEIDS, Object.keys(this.state[StateEntries.INSTANCES]), finalCallbacker.makeCountedCallback());
};

UProxyState.prototype.loadStateFromStorage = function (callback) {
    this.state = restrictKeys(DEFAULT_LOAD_STATE, this.state);
    var finalCallbacker = new FinalCallback(callback);
    this.loadMeFromStorage(finalCallbacker.makeCountedCallback());
    this.loadOptionsFromStorage(finalCallbacker.makeCountedCallback());
    this.loadAllInstances(finalCallbacker.makeCountedCallback());
};

UProxyState.prototype.saveStateToStorage = function (callback) {
    var finalCallbacker = new FinalCallback(callback);
    this.saveMeToStorage(finalCallbacker.makeCountedCallback());
    this.saveOptionsToStorage(finalCallbacker.makeCountedCallback());
    this.saveAllInstances(finalCallbacker.makeCountedCallback());
};
