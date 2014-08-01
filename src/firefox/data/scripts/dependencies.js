/**
 * Inject dependencies from content script
 */
angular.module('dependencyInjector', [])
  .filter('i18n', function () {
    return function (key) {
        return key;
    };
  })
  .constant('ui', window.ui)
  .constant('model', window.model)
  .constant('core', window.core);


