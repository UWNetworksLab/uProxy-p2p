'use strict';

var popup = angular.module('UProxyExtension-popup', ['UProxyExtension'])
  // Main extension controller.
  .controller('MainCtrl', ['$scope', function ($scope) {


    // State for roster vs. detail view.
    $scope.rosterNudge = false;
    $scope.currentContact = {
      'name': 'Nobody'
    };
    $scope.instances = $scope.model.instances;
    var _getTrust = function(client) {
      return $scope.instances[client.instanceId].trust;
    };

    // Whether UProxy is logged in to *any* network.
    $scope.loggedIn = function() {
      return $scope.isOnline('google') || $scope.isOnline('facebook');
    };

    // Opening the detailed contact view.
    $scope.toggleContact = function(c) {
      $scope.currentContact = c;
      console.log(c);
      $scope.rosterNudge = true;
    };

    // Multifiter function for determining whether a contact should be hidden.
    $scope.contactIsHidden = function(c) {
      var searchText = $scope.search,
          compareString = c.name.toLowerCase();
      // If there is no search text and no filters are active, nothing is
      // hidden.
      if (!searchText) {
        return false;
      }
      if (compareString.indexOf(searchText) >= 0) {
        return false;  // Valid substring, should be visible.
      }
      return true;
    };
  }])
  // The controller for debug information/UI.
  .controller('DebugCtrl', ['$filter', '$scope', 'freedom', 'model',
      function ($filter, $scope, freedom, model) {
    // var messageable = $filter('messageable');

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
