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
    $scope.optionsTooltip = false;

    $scope.filterTips = {
      'uproxy': 'Only show contacts with UProxy installed.',
      'myAccess': 'Show contacts who provide me access.',
      'friendsAccess': 'Show contacts who use me for access.',
      'online': 'Show offline contacts.',
    };
    var _getTrust = function(client) {
      return $scope.instances[client.instanceId].trust;
    };

    // On the contacts details page, dynamically update |currentInstance| to
    // reflect user actions and state changes in the DOM.
    // $scope.updateCurrentInstance = function() {
      // if (!$scope.ui.instance) {
        // return;
      // }
      // $scope.$apply(function() {
        // $scope.ui.instance = $scope.instances[$scope.ui.instance.instanceId];
      // });
    // }

    // On an update to the roster, update the variously sorted lists.
    // TODO(uzimizu): actually implement variety of sorting methods
    $scope.updateSortedContacts = function() {
      $scope.alphabeticalContacts = []
    };

    // Opening the detailed contact view.
    $scope.viewContact = function(c) {
      console.log("viewContact: c=\n", c);
      for (var clientId in c.clients) {
        if ($scope.isMessageableUproxyClient(c.clients[clientId])) {
          console.log("viewContact: sendInstance: " + clientId);
          $scope.sendInstance(clientId);
        }
      }
      $scope.ui.contact = c;
      $scope.ui.instance = $scope.instanceOfContact(c);
      console.log('current instance ' + $scope.ui.instance);
      $scope.ui.rosterNudge = true;
      $scope.notificationSeen(c);
      if (!$scope.ui.isProxying) {
        $scope.ui.proxy = null;
      }
      // $scope.ui.refreshDOM();
    };

    // Toggling the 'options' page which is just the splash page.
    $scope.toggleOptions = function() {
      $scope.ui.splashPage = !$scope.ui.splashPage;
    };

    $scope.toggleSearch = function() {
      $scope.ui.searchBar = !$scope.ui.searchBar;
    };

    // Display the help tooltip for the filter.
    $scope.showFilter = function(filter) {
      $scope.filterTip = $scope.filterTips[filter];
      $scope.showFilterTip = true;
    };

    $scope.$watch('ui.contact',function(){
      var contact = $scope.ui.contact;
      if (contact) {
        console.log('current contact changed');
        $scope.ui.contact = $scope.model.roster[contact.userId];
      }
    });
    $scope.$watch('ui.instance',function(){
      var instance = $scope.ui.instance;
      if (instance) {
        console.log('current instance changed');
        $scope.ui.instance = $scope.model.instances[instance.instanceId];
      }
    });
    // Refresh local state variables when the popup is re-opened.
    // if ($scope.ui.contact) {
      // $scope.ui.contact = $scope.model.roster[$scope.ui.contact.userId];
    // }
    // if ($scope.ui.instance) {
      // $scope.ui.instance = $scope.model.instances[$scope.ui.instance.instanceId];
    // }
  }]);
