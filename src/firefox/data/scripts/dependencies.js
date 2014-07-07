/**
 * @fileoverview Description of this file.
 */
angular.module('dependencyInjector', []).filter('i18n', function () {
    return function (key) {
        return key;
    };
}).constant('ui', window.ui).constant('model', window.model)
  .constant('core', window.core);
console.log("added dependencies ")
console.log(window.model.networks);


