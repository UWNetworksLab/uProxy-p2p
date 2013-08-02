'use strict';

angular.module('UProxyChromeExtension')
  .controller('MainCtrl', [function () {
    }
  ])
  .controller('DebugCtrl', ['$scope', 'freedom', function($scope, freedom) {
    $scope.sendMsg = function () {
      console.log($scope.chatbuddy);
      if ($scope.chatbuddy && $scope.chatbuddy.devices) {
      //Look for a messageable device
        var devices = $scope.chatbuddy.devices;
        for (var i = 0; i < devices.length; i++) {
          if (devices[i].status == 'messageable') {
            freedom.emit('send-message', {to: devices[i].deviceId, message: $scope.msg});
            $scope.msg = '';
            //TODO: Currently only sending to first UProxy instance
            return;
          }
        }
      } 
      if ($scope.chatbuddy && $scope.chatbuddy.userId) {
        //Invite friend to UProxy
        freedom.emit('echo', "Invitation send to "+$scope.chatbuddy.userId);
        freedom.emit('invite-friend', $scope.chatbuddy.userId);
      } else {
        freedom.emit('echo', "Please select a friend");
      }
    };
  }]);
