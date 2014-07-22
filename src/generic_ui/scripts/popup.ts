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

    // TODO: Move filters into a directive.
    $scope.filterTips = {
      'uproxy': 'Only show contacts with uProxy installed.',
      'myAccess': 'Show contacts who provide me access.',
      'friendsAccess': 'Show contacts who use me for access.',
      'online': 'Only show online contacts.',
    };

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

    // Display the help tooltip for the filter.
    $scope.showFilter = (filter) => {
      $scope.filterTip = $scope.filterTips[filter];
      $scope.showFilterTip = true;
    };

    $scope.login = (network) => {
      ui.login(network);
    };

    $scope.logout = (network) => {
      ui.logout(network);
    };

    $scope.MANUAL_NETWORK_ID = Social.MANUAL_NETWORK_ID;
  }]);
