// Include this file to avoid ECMAScript 5 strict mode errors
// related to creation of global objects, in particular freedom.js
// in unit tests - while neither the Chrome nor Firefox extension
// environments implement strict mode, recent versions of phantomjs
// (used by jasmine), do as of course do Chrome and Firefox when
// loading and debugging the SpecRunner manually.

// There are a bunch of helpers under src/freedom/mocks which can
// inject behaviour into this object.
var freedom = {};
