'use strict';

angular.module('UProxyChromeExtension-options', ['UProxyChromeExtension'])
  .run(['$rootScope', 'model', function ($rootScope, model) {
    // sketch out some mock data. TODO: this should come from backend
    var unwatch = $rootScope.$watch('model.roster', function (roster, oldRoster) {
      if (!roster) return;
      model.contacts = angular.copy(model.roster);
      angular.forEach(model.contacts, function (contact) {
        angular.forEach(contact.clients, function (client, clientId) {
          client.clientName = contact.name+'ʼs client "'+clientId+'"';
          client.staticId = contact.name+'ʼs static ID';
          // whether we want to get access through this client
          client.desiredAsServer = !(contact.name.charCodeAt(0) % 2);
          // whether this client has permission to proxy through me
          client.hasClientPermission = !(contact.name.charCodeAt(1) % 2);
        });
      });

      model.profile = {
        clientName: model.me.name+'ʼs client',
        staticId: model.me.name+'ʼs static ID',
        publicKey: model.me.name+'ʼs public key'
      };

      unwatch();
    }, true);
  }])
  .controller('OptionsCtrl', ['$scope', 'freedom', 'model',
    function ($scope, freedom, model) {
      $scope.$watch('model.options', function (opts) {
        angular.forEach(opts, function (val, key) {
          $scope[key] = val;
        });
      }, true);
    }]);
