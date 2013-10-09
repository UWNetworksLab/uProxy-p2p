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
      'all': true,
      'online': true,
      'myAccess': false,
      'friendsAccess': false
    };
    $scope.instances = $scope.model.instances;

    //
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
    // reflect user actions.
    $scope.updateCurrentInstance = function() {
      if (!$scope.currentInstance) {
        return;
      }
      $scope.$apply(function() {
        $scope.currentInstance = $scope.model.instances[$scope.currentInstance.instanceId];
      });
    }
    $scope.onAppData.addListener($scope.updateCurrentInstance);

    // TODO: fix using watchs on the contact of interest. Currently updates are
    // not correctly propegated.
    //
    // Opening the detailed contact view.
    $scope.toggleContact = function(c) {
      $scope.currentContact = c;
      $scope.currentInstance = $scope.instanceOfUserId(c.userId);
      // Watch the instance on the model to keep the UI up to date.
      // $scope.$watch('instances', function(v) {
        // $scope.$apply(function() {
          // $scope.currentInstance = $scope.instanceOfUserId(c.userId);
        // });
      // });
      $scope.rosterNudge = true;
    };

    // Toggling the 'options' page which is just the splash page.
    $scope.toggleOptions = function() {
      $scope.splashPage = !$scope.splashPage;
    };

    // Multifiter function for determining whether a contact should be hidden.
    $scope.contactIsFiltered = function(c) {
      var searchText = $scope.search,
          compareString = c.name.toLowerCase();
      // First, compare filters.
      if (!$scope.filters.offline && !c.online) {
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
