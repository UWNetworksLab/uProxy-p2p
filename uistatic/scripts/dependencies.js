console.log('This is not a real uProxy frontend.');


var model = state || { identityStatus: {} };

var mockNotifications = (function () {
    function mockNotifications() {
    }
    mockNotifications.prototype.setIcon = function (iconFile) {
        console.log('setting icon to ' + iconFile);
    };
    mockNotifications.prototype.setLabel = function (text) {
        console.log('setting label to: ' + text);
    };
    mockNotifications.prototype.setColor = function (color) {
        console.log('setting background color of the badge to: ' + color);
    };
    return mockNotifications;
})();

var ui = new UI(new mockNotifications());

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
        ui.synchronize();
    }
}).constant('onStateChange', null).constant('ui', ui).constant('model', model).constant('roster', null);
