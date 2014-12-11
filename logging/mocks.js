// Create a mock instance of Freedom.
// We do this in a non-TypeScript file because the ambient module declaration
// prevents us creating any variable called freedom in TypeScript-land.
// Note: used by both logger and logging modules.
var freedom = function() {
  return {
    provideSynchronous: function() {}
  };
};
freedom['loggers'] = {};
freedom['core'] = function () {
  return {
    'getLogger': function(tag) {
      var logger = jasmine.createSpyObj('logger-'+tag, ['log', 'info', 'error']);
      freedom['loggers'][tag] = logger;
      return Promise.resolve(logger);
    }
  }
};

freedom['core.console'] = jasmine.createSpy().and.returnValue(
    jasmine.createSpyObj('core.console', ['debug', 'log', 'info', 'warn', 'error']));
