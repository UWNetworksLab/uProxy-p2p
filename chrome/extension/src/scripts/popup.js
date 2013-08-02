'use strict';

angular.module('UProxyChromeExtension')
  .controller('MainCtrl', [function () {
}])
  .controller('DebugCtrl', ['$scope', 'freedom', function($scope, freedom) {
    $scope.sendMsg = function () {
      if ($scope.chatbuddy && $scope.chatbuddy.devices) {
        var devices = $scope.chatbuddy.devices;
        for (var i = 0; i < devices.length; i++) {
          if (devices[i].status === 'online') {
            freedom.emit('send-message', {to: devices[i].deviceId, message: $scope.msg});
            $scope.msg = '';
            return;
          }
        }
      }
      freedom.emit('echo', 'No available recipient: ' + $scope.msg);
      $scope.msg = '';
    };
  }]);
