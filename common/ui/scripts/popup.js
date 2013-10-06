/**
 * popup.js
 *
 * This is the script which controls the beavior of the popup component of the
 * frontend. The popup contains a contacts list and filters which allow the user
 * to conveniently access all desired uproxy info and interactions.
 */

'use strict';

var popup = angular.module('UProxyExtension-popup', ['UProxyExtension'])
  // Main extension controller.
  .controller('MainCtrl', ['$scope', function ($scope) {

    // State for roster vs. detail view.
    $scope.rosterNudge = false;
    $scope.currentContact = {
      'name': 'Nobody'
    };
    // Initial filter state.
    $scope.filters = {
      'all': true,
      'online': true,
      'myAccess': false,
      'friendsAccess': false
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
    $scope.contactIsFiltered = function(c) {
      var searchText = $scope.search,
          compareString = c.name.toLowerCase();
      // First, compare filters.
      if (!$scope.filters.offline && !c.online) {
        return true;
      }
      // for (var filter in $scope.filters) {
        // if ($scope.filters[filter] && c[filter])
          // return true;
      // }
      // Otherwise, if there is no search text, this contact is visible.
      if (!searchText) {
        return false;
      }
      if (compareString.indexOf(searchText) >= 0) {
        return false;
      }
      return true;  // Does not match the search text, should be hidden.
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
