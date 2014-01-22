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
    return MockCore;
})();

var ui = new UI(new MockNotifications(), new MockCore());

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
