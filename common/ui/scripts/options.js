'use strict';

angular.module('UProxyExtension-options', ['UProxyExtension'])
  .run(['$rootScope', 'model', function ($rootScope, model) {
    // Can add stuff here if we want/need for the options page.
  }])
  .controller('OptionsCtrl', ['$scope', 'freedom', 'model',
    function ($scope, freedom, model) {
      $scope.instances = model.instances;
    }]);
