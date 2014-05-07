/**
 * popup.js
 *
 * This is the script which controls the beavior of the popup component of the
 * frontend. The popup contains a contacts list, filters, options, connection
 * details, and any other functionality required by the user. It extends from
 * the base UProxyExtension angular module defined in app.js.
 */

angular.module('UProxyExtension-popup', ['UProxyExtension'])
  // Main extension controller.
  .controller('MainCtrl', ['$scope', ($scope) => {
    // View states.
    var ui = $scope.ui;
    var core = $scope.core;
    // $scope.optionsTooltip = false;

    var syncContactWatch = function(userId) {
      if (ui.contactUnwatch) {
        ui.contactUnwatch();
        ui.contactUnwatch = null;
      }
      ui.contactUnwatch = $scope.$watch(
          'model.roster["' + userId + '"]', function() {
            ui.contact = $scope.model.roster[userId];
      });
    }
    var syncInstanceWatch = function(instanceId) {
      // Check for new instance binding, to re-watch.
      if (ui.instanceUnwatch) {
        ui.instanceUnwatch();
        ui.instanceUnwatch = null;
      }
    };

    $scope.filterTips = {
      'uproxy': 'Only show contacts with UProxy installed.',
      'myAccess': 'Show contacts who provide me access.',
      'friendsAccess': 'Show contacts who use me for access.',
      'online': 'Only show online contacts.',
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
    $scope.updateSortedContacts = () => {
      $scope.alphabeticalContacts = []
    };

    // Toggling the 'options' page which is just the splash page.
    $scope.toggleOptions = () => {
      // ui.view = UI.View.ROSTER;
      console.log('Viewing splash page');
      ui.toggles.splash = !ui.toggles.splash;
    };

    $scope.toggleSearch = () => {
      ui.toggles.search = !ui.toggles.search;
    };

    // Display the help tooltip for the filter.
    $scope.showFilter = (filter) => {
      $scope.filterTip = $scope.filterTips[filter];
      $scope.showFilterTip = true;
    };

    $scope.$watch('ui.focus', () => {
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
    });

    if (ui.contact) {
      syncContactWatch(ui.contact.userId);
    }
    if (ui.instance) {
      syncInstanceWatch(ui.instance.instanceId);
    }

  }]);
