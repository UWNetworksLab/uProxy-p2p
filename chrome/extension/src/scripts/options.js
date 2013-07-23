'use strict';

angular.module('UProxyChromeExtension')
  .controller('OptionsCtrl', ['$scope', 'freedom', 'model',
    function ($scope, freedom, model) {
      $scope.model = model;

      $scope.$watch('model.options', function (opts) {
        angular.forEach(opts, function (val, key) {
          $scope[key] = val;
        });
      }, true);

      $scope.changeOption = function (key, value) {
        freedom.emit('changeOption', {key: key, value: value});
      };
    }]);
