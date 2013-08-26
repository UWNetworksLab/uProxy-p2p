'use strict';

angular.module('UProxyChromeExtension-options', ['UProxyChromeExtension'])
  .controller('OptionsCtrl', ['$scope', 'freedom', 'model',
    function ($scope, freedom, model) {
      $scope.$watch('model.options', function (opts) {
        angular.forEach(opts, function (val, key) {
          $scope[key] = val;
        });
      }, true);
    }]);
