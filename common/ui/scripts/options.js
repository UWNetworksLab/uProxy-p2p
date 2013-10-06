'use strict';

angular.module('UProxyExtension-options', ['UProxyExtension'])
  .run(['$rootScope', 'model', function ($rootScope, model) {
    $rootScope.$watch('model.me.peerAsProxy', function (newValue, oldValue) {

    }

    // sketch out some mock data. TODO: this should come from backend
    var unwatch = $rootScope.$watch('model.roster',
        function (roster, oldRoster) {
      if (!roster) return;
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
      $scope.instances = model.instances;
    }]);
