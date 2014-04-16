/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />

declare var TESTDATA_EXAMPLE_STATE :Object;
declare var TESTDATA_EXAMPLE_SAVED_STATE :Object;

// Note: this doesn't work when debugging in chrome: it hits the content
// security policy.
function readJsonFile(location) {
  var xhr = new XMLHttpRequest();
  xhr.open('get', location, false);
  xhr.overrideMimeType('text/json; charset=utf-8');
  xhr.send();
  return JSON.parse(xhr.responseText);
}

// jasmine.DEFAULT_TIMEOUT_INTERVAL = 1000000;
var stateStorage = new Core.State();
Core.DEBUG_STATESTORAGE = false;

// Depends on the MockStorage that executes everything synchronously.
describe('state-storage', function() {
  var exampleState = TESTDATA_EXAMPLE_STATE;
  var exampleSavedState = TESTDATA_EXAMPLE_SAVED_STATE;

  it('* Example states are not null', function() {
    expect(exampleState).not.toBe(null);
    expect(exampleSavedState).not.toBe(null);
  });
  it('* Initial state is default state', function() {
    expect(stateStorage.state).toEqual(C.DEFAULT_LOAD_STATE);
  });
  it('* Saving state does not change state', function(done) {
    // Make state a deep-copy of exampleState.
    stateStorage.state = cloneDeep(exampleState);
    // Saving state should should not change the state.
    stateStorage.saveStateToStorage().then(function() {;
      expect(stateStorage.state).toEqual(exampleState);
    }).then(done);
  });

  var stateReloadedDirectly;
  it('* Loading the saved state directly does not change anthing', function(done) {
    // Resetting the state, but loading the saved state should give the same
    // example state back.
    stateStorage.loadStateFromStorage().then(function() {
      stateReloadedDirectly = cloneDeep(stateStorage.state);
      expect(Object.keys(stateReloadedDirectly.roster).length).toEqual(1);
      expect(stateReloadedDirectly).toEqual(exampleState);
    }).then(done);
  });
  var stateLoadedFromDefault;
  it('* Loading from C.DEFAULT_LOAD_STATE has the same instances', function(done) {
    stateStorage.state = cloneDeep(C.DEFAULT_LOAD_STATE);
    stateStorage.loadStateFromStorage().then(function() {;
      stateLoadedFromDefault = cloneDeep(stateStorage.state);
      expect(stateLoadedFromDefault.instances)
          .toEqual(stateReloadedDirectly.instances);
    }).then(done);
  });

  it('* ... and 1 entry in the roster', function() {
    expect(Object.keys(stateLoadedFromDefault.roster).length).toEqual(1);
  });
  it('* ... but no clients for that entry.', function() {
    var firstKey = (Object.keys(stateLoadedFromDefault.roster))[0];
    expect(stateLoadedFromDefault.roster[firstKey].clients).toEqual({});
  });
  var stateLoadedFromEmpty;
  it('* Loading from {} is same as default', function(done) {
    stateStorage.state = {};
    stateStorage.loadStateFromStorage().then(function() {
      stateLoadedFromEmpty = cloneDeep(stateStorage.state);
      expect(stateLoadedFromEmpty).toEqual(stateLoadedFromDefault);
    }).then(done);
  });
  it('* Saving and loading again does not change anything', function() {
    // Saving and loading the same thing should not change the value of the
    // state.
    stateStorage.saveStateToStorage();
    stateStorage.loadStateFromStorage();
    expect(stateStorage.state).toEqual(stateLoadedFromDefault);
  });
  var wasResetCallbackCalled = false;
  it('* Reset works just like load from C.DEFAULT_LOAD_STATE', function(done) {
    // reseting the state and loading should be the same as the
    // C.DEFAULT_LOAD_STATE.
    stateStorage.reset().then(function() {
      wasResetCallbackCalled = true;
      expect(stateStorage.state.options).toEqual(C.DEFAULT_LOAD_STATE.options);
      expect(stateStorage.state.roster).toEqual(C.DEFAULT_LOAD_STATE.roster);
      expect(stateStorage.state.instances).toEqual(C.DEFAULT_LOAD_STATE.instances);
    }).then(done);
    // expect(stateStorage.state).toEqual(stateLoadedFromDefault);
    // expect(stateStorage.state.options)
        // .toEqual(stateLoadedFromDefault.options);
    // expect(stateStorage.state.instances)
        // .toEqual(stateLoadedFromDefault.instances);
        // .toEqual(C.DEFAULT_LOAD_STATE.instances);
    // expect(stateStorage.state.roster)
        // .toEqual(stateLoadedFromDefault.roster);
    // expect(stateStorage.state.me)
        // .toEqual(stateLoadedFromDefault.me);
  });

});  // state-storage
