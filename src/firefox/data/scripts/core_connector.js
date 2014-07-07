var SYNC_TIMEOUT = 1000;

;

var ChromeCoreConnector = (function () {
    function ChromeCoreConnector(options_) {
        var _this = this;
        this.options_ = options_;
        this.promiseId_ = 1;
        this.mapPromiseIdToFulfillAndReject_ = {};
        this.connect = function () {
          return Promise.resolve();
        };
        this.onUpdate = function (update, handler) {
            console.log("on update " + update);
            self.port.on(update, handler);

        };
        this.sendCommand = function (command, data) {
            console.log("emit " + command);
            self.port.emit(command, {'data': data});
        };
        this.promiseCommand = function (command, data) {
            var promiseId = ++(_this.promiseId_);

            var fulfillFunc;
            var rejectFunc;
            var promise = new Promise(function (F, R) {
                fulfillFunc = F;
                rejectFunc = R;
            });

            _this.mapPromiseIdToFulfillAndReject_[promiseId] = {
                fulfill: fulfillFunc,
                reject: rejectFunc
            };

            payload = {
              promiseId: promiseId,
              data: data
            }
            console.log('UI sending Promise Command '+ command + " data " + JSON.stringify(payload));
            self.port.emit(command, payload);
            return promise;
        };
        this.handleRequestFulfilled_ = function (promiseId) {
            console.log('promise command fulfilled ' + promiseId);
            if (_this.mapPromiseIdToFulfillAndReject_[promiseId]) {
                _this.mapPromiseIdToFulfillAndReject_[promiseId].fulfill();
                delete _this.mapPromiseIdToFulfillAndReject_[promiseId];
            } else {
                console.warn('fulfill not found ' + promiseId);
            }
        };
        this.handleRequestRejected_ = function (promiseId) {
            console.log('promise command rejected ' + promiseId);
            if (_this.mapPromiseIdToFulfillAndReject_[promiseId]) {
                _this.mapPromiseIdToFulfillAndReject_[promiseId].reject();
                delete _this.mapPromiseIdToFulfillAndReject_[promiseId];
            } else {
                console.warn('reject not found ' + promiseId);
            }
        };
        this.reset = function () {
            console.log('Resetting.');
            _this.sendCommand(1002 /* RESET */, null);
        };
        this.sendInstance = function (clientId) {
            _this.sendCommand(1005 /* SEND_INSTANCE */, clientId);
        };
        this.modifyConsent = function (command) {
            console.log('Modifying consent.', command);
            _this.sendCommand(1012 /* MODIFY_CONSENT */, command);
        };
        this.start = function (path) {
            console.log('Starting to proxy through ' + path);
            return _this.promiseCommand(1010 /* START_PROXYING */, path).then(function () {
                console.log('startUsingProxy');
                proxyConfig.startUsingProxy();
            });
        };
        this.stop = function () {
            console.log('Stopping proxy session.');
            _this.sendCommand(1011 /* STOP_PROXYING */);
        };
        this.updateDescription = function (description) {
            console.log('Updating description to ' + description);
            _this.sendCommand(1008 /* UPDATE_DESCRIPTION */, description);
        };
        this.changeOption = function (option) {
            console.log('Changing option ' + option);
        };
        this.login = function (network) {
          console.log("login");
            return _this.promiseCommand(1003 /* LOGIN */, network);
        };
        this.logout = function (network) {
            _this.sendCommand(1004 /* LOGOUT */, network);
        };
        this.status = { connected: true };

        this.onUpdate(2008 /* COMMAND_FULFILLED */, this.handleRequestFulfilled_);
        this.onUpdate(2009 /* COMMAND_REJECTED */, this.handleRequestRejected_);
    }
    return ChromeCoreConnector;
})();
