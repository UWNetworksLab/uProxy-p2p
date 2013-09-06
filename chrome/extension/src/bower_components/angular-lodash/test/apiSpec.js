describe('angular-lodash: API', function() {
  beforeEach(module('_'));
  _.each(_.functions(_), function(fnName) {
    it(fnName + " should adapt to lodash's "+ fnName, inject(function($rootScope) {
      expect($rootScope[fnName].toString()).toBe(_[fnName].toString());
    }));
  });
});
