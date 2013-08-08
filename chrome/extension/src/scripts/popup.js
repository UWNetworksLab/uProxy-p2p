'use strict';

angular.module('UProxyChromeExtension')
  .controller('MainCtrl', [function () {
}])
  .controller('DebugCtrl', ['$scope', 'freedom', function($scope, freedom) {
    $scope.sendMsg = function () {
      console.log($scope.chatbuddy);
      if ($scope.chatbuddy && $scope.chatbuddy.clients) {
      //Look for a messageable device
        var clients = $scope.chatbuddy.clients;
        for (var i in clients) {
          if (clients.hasOwnProperty(i) && clients[i].status == 'messageable') {
            freedom.emit('send-message', {to: clients[i].clientId, message: $scope.msg});
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
