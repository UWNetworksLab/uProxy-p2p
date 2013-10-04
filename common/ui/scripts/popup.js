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
    }

    $scope.toggleContact = function(c) {
      // c.detailsVisible = !c.detailsVisible;
      $scope.currentContact = c;
      console.log(c);
      $scope.rosterNudge = true;
    };

    $scope.startAccess = function(client) {
      $scope.sendMessage(client.clientId, 'start-proxying');
    };
    // Request access through a friend.
    $scope.requestAccess = function(client) {
      $scope.sendMessage(client.clientId, 'request-access');
      var trust = _getTrust(client);
      // Emit to freedom.
      // $scope.client.permissions.proxy = 'requested';
    };

    $scope.grantAccess = function(client) {
      sendMessage(client.clientId, 'allow');
      var trust = _getTrust(client);
      // trust.asClient = 'yes';
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
