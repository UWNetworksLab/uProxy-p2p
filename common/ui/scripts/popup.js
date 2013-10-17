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
    var ui = $scope.ui;
    $scope.optionsTooltip = false;

    var syncInstanceWatch = function(instanceId) {
      // Check for new instance binding, to re-watch.
      if (ui.instanceUnwatch) {
        ui.instanceUnwatch();
        ui.instanceUnwatch = null;
      }
      ui.instanceUnwatch = $scope.$watch(
          'model.instances["' + instanceId + '"]', function() {
            ui.instance = $scope.model.instances[instanceId];
          });
    };

    // Open the detailed contact view, with a potential instance. Set the
    // currently focused instance and ensure angular bindings work.
    $scope.viewContact = function(c) {
      console.log("viewContact: c=\n", c);
      for (var clientId in c.clients) {
        if ($scope.isMessageableUproxyClient(c.clients[clientId])) {
          console.log("viewContact: sendInstance: " + clientId);
          $scope.sendInstance(clientId);
        }
      }
      ui.contact = c;
      var instance = $scope.instanceOfContact(c);
      if (instance) {
        ui.instance = instance;
        syncInstanceWatch(instance.instanceId);
      } else {
        ui.instance = null;
      }
      console.log('current instance ' + ui.instance);

      $scope.notificationSeen(c);
      if (!ui.isProxying) {
        ui.proxy = null;
      } else {
        ui.proxy = $scope.model.instances[proxy.instanceId];
      }
      ui.rosterNudge = true;
    };

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

    $scope.$watch('ui.focus',function(){
      var contact = ui.contact;
      if (contact) {
        console.log('current contact changed');
        ui.contact = $scope.model.roster[contact.userId];
      }
      var instance = ui.instance;
      if (instance) {
        console.log('current instance changed');
        ui.instance = $scope.model.instances[instance.instanceId];
      }
      // $scope.$digest();
    });

    if (ui.instance) {
      syncInstanceWatch(ui.instance.instanceId);
    }
    // Refresh local state variables when the popup is re-opened.
    // if ($scope.ui.contact) {
      // $scope.ui.contact = $scope.model.roster[$scope.ui.contact.userId];
    // }
    // if ($scope.ui.instance) {
      // $scope.ui.instance = $scope.model.instances[$scope.ui.instance.instanceId];
    // }
  }]);
