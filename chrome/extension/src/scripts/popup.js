'use strict';

angular.module('UProxyChromeExtension')
  .controller('MainCtrl', [function () {
    }
  ])
  .controller('DebugCtrl', ['$scope', 'freedom', function($scope, freedom) {
    $scope.sendMsg = function () {
      freedom.emit('send-message', {to: '', message: $scope.msg});
      $scope.msg = '';
    };
  }]);
