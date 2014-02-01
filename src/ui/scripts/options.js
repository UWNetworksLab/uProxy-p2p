'use strict';

angular.module('UProxyExtension-options', ['UProxyExtension'])
  .run(['$rootScope', function ($rootScope) {
    // Can add stuff here if we want/need for the options page.
  }])
  .controller('OptionsCtrl', ['$scope',
    function ($scope) {
      // $scope.instances = model.instances;
    }]);
