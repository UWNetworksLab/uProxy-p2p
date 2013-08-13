'use strict';

console.log('loading popup.js');

angular.module('UProxyChromeExtension')
  .controller('MainCtrl', [function () {
}])
  .controller('DebugCtrl', ['$filter', '$scope', 'freedom', 'model', function ($filter, $scope, freedom, model) {
    var messageable = $filter('messageable');

    $scope.submitChat = function () {
      var contact = model.roster[$scope.userId];
      if (!contact) {
        console.error('not on roster:', $scope.userId);
        return;
      }
      if (messageable(contact)) {
        // only sends to UProxy clients
        $scope.sendMessage(contact, $scope.msg);
      } else {
        freedom.emit('send-message', {to: contact.userId, message: $scope.msg});
      }
      $scope.msg = '';
    };
  }]);
