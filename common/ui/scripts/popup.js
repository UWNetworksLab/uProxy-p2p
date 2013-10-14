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
    // View states.
    $scope.splashPage = false;   // Splash / options page.
    $scope.rosterNudge = false;  // Full roster vs. Individual Contact Details
    $scope.advancedOptions = false;

    // Initial filter state.
    $scope.filters = {
      'alpha': true,
      'online': true,
      'myAccess': false,
      'friendsAccess': false,
      'uproxy': false
    };
    $scope.filterTips = {
      'uproxy': 'Only show contacts with UProxy installed.',
      'myAccess': 'Show contacts who provide me access.',
      'friendsAccess': 'Show contacts who use me for access.',
      'online': 'Show offline contacts.',
      'alpha': 'Sort alphabetically',
    };
    $scope.currentContact = {};  // Visible for the individual contact page.
    $scope.currentInstance = null;  // Visible for the individual contact page.

    var _getTrust = function(client) {
      return $scope.instances[client.instanceId].trust;
    };

    $scope.stringifyContact = function(contact) {
      return JSON.stringify(contact);
    };
    $scope.splashPage = !$scope.loggedIn();

    // On the contacts details page, dynamically update |currentInstance| to
    // reflect user actions and state changes in the DOM.
    $scope.updateCurrentInstance = function() {
      if (!$scope.currentInstance) {
        return;
      }
      $scope.$apply(function() {
        $scope.currentInstance = $scope.instances[$scope.currentInstance.instanceId];
      });
    }
    // Attach to the App-Extension channel.
    // $scope.onAppData.addListener($scope.updateCurrentInstance);

    // On an update to the roster, update the variously sorted lists.
    // TODO(finish)
    $scope.updateSortedContacts = function() {
      $scope.alphabeticalContacts = []
      // .sort()
    };
    // $scope.onAppData.addListener($scope.updateSortedContacts);

    // Opening the detailed contact view.
    $scope.viewContact = function(c) {
      $scope.currentContact = c;
      $scope.currentInstance = $scope.instanceOfUserId(c.userId);
      console.log('current instance ' + $scope.currentInstance);
      $scope.rosterNudge = true;
      $scope.notificationSeen(c);
    };

    // Toggling the 'options' page which is just the splash page.
    $scope.toggleOptions = function() {
      $scope.splashPage = !$scope.splashPage;
    };

    $scope.toggleFilter = function(filter) {
      if (undefined === $scope.filters[filter]) {
        return;
      }
      console.log('Toggling ' + filter + ' : ' + $scope.filters[filter]);
      $scope.filters[filter] = !$scope.filters[filter];

    };

    // Display the help tooltip for the filter.
    $scope.showFilter = function(filter) {
      $scope.filterTip = $scope.filterTips[filter];
      $scope.showFilterTip = true;
    };

    // Multifiter function for determining whether a contact should be hidden.
    // Returns |true| if contact |c| should *not* appear in the roster.
    $scope.contactIsFiltered = function(c) {
      var searchText = $scope.search,
          compareString = c.name.toLowerCase();
      // First, compare filters.
      if (($scope.filters.online && !c.online) ||
          ($scope.filters.uproxy && !c.canUProxy)) {
        return true;
      }
      // Otherwise, if there is no search text, this contact is visible.
      if (!searchText) {
        return false;
      }
      if (compareString.indexOf(searchText) >= 0) {
        return false;
      }
      return true;  // Does not match the search text, should be hidden.
    };
  }]);
