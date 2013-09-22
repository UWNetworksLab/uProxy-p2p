'use strict';

angular.module('UProxyExtension-popup', ['UProxyExtension'])
  // Extension stores no initial state for the main controller.
  .controller('MainCtrl', ['$scope', function ($scope) {
    $scope.toggleContact = function(c) {
      c.detailsVisible = !c.detailsVisible;
    }
    // $scope.showContact = function(c) {
      // c.detailsVisible = true;
    // };
    // $scope.hideContact = function(c) {
      // c.detailsVisible = false;
    // }
  }])
  // The controller for debug information/UI.
  .controller('DebugCtrl', ['$filter', '$scope', 'freedom', 'model',
      function ($filter, $scope, freedom, model) {
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
  }])
  .constant('meow', function() {
    alert('rofl');
  });


