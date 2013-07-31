'use strict';

angular.module('UProxyChromeExtension')
  .controller('OptionsCtrl', ['$scope', 'freedom', 'model',
    function ($scope, freedom, model) {
      $scope.model = model;

      // XXX move to run block once https://github.com/angular/angular.js/issues/2963 is fixed
      $scope.$watch('model.options.mode', function (mode) {
        if (!mode) return;
        $scope.inGiveMode = mode === 'give';
        $scope.inGetMode = mode === 'get';
      });

      $scope.$watch('model.options', function (opts) {
        angular.forEach(opts, function (val, key) {
          $scope[key] = val;
        });
      }, true);
    }]);
