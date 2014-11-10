// Create a mock instance of Freedom.
// We do this in a non-TypeScript file because the ambient module declaration
// prevents us creating any variable called freedom in TypeScript-land.
var freedom = {};
freedom['core.console'] = jasmine.createSpy().and.returnValue(
    jasmine.createSpyObj('core.console', ['log', 'error']));
