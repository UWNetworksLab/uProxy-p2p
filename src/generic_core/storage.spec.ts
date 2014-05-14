/// <reference path='storage.ts' />
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

var storage = new Core.Storage();
Core.DEBUG_STATESTORAGE = false;

// Depends on the MockStorage that executes everything synchronously.
describe('state-storage', () => {
  var exampleState = TESTDATA_EXAMPLE_STATE;
  var exampleSavedState = TESTDATA_EXAMPLE_SAVED_STATE;

  /*
  it('* Example states are not null', () => {
    expect(exampleState).not.toBe(null);
    expect(exampleSavedState).not.toBe(null);
  });
  it('* Saving state does not change state', (done) => {
    // Make state a deep-copy of exampleState.
    storage.state = cloneDeep(exampleState);
    // Saving state should should not change the state.
    storage.saveStateToStorage().then(() => {
      expect(storage.state).toEqual(exampleState);
    }).then(done);
  });

  var stateReloadedDirectly;
  it('* Loading the saved state directly does not change anything', (done) => {
    // Resetting the state, but loading the saved state should give the same
    // example state back.
    storage.loadStateFromStorage().then(() => {
      stateReloadedDirectly = cloneDeep(storage.state);
      expect(Object.keys(stateReloadedDirectly.roster).length).toEqual(1);
      expect(stateReloadedDirectly).toEqual(exampleState);
    }).then(done);
  });
  var stateLoadedFromDefault;
  it('* Loading from C.DEFAULT_LOAD_STATE has the same instances', (done) => {
    storage.state = cloneDeep(C.DEFAULT_LOAD_STATE);
    storage.loadStateFromStorage().then(() => {
      stateLoadedFromDefault = cloneDeep(storage.state);
      expect(stateLoadedFromDefault.instances)
          .toEqual(stateReloadedDirectly.instances);
    }).then(done);
  });

  it('* ... and 1 entry in the roster', () => {
    expect(Object.keys(stateLoadedFromDefault.roster).length).toEqual(1);
  });
  it('* ... but no clients for that entry.', () => {
    var firstKey = (Object.keys(stateLoadedFromDefault.roster))[0];
    expect(stateLoadedFromDefault.roster[firstKey].clients).toEqual({});
  });
  var stateLoadedFromEmpty;
  it('* Loading from {} is same as default', (done) => {
    storage.state = {};
    storage.loadStateFromStorage().then(() => {
      stateLoadedFromEmpty = cloneDeep(storage.state);
      expect(stateLoadedFromEmpty).toEqual(stateLoadedFromDefault);
    }).then(done);
  });
  it('* Saving and loading again does not change anything', () => {
    // Saving and loading the same thing should not change the value of the
    // state.
    storage.saveStateToStorage();
    storage.loadStateFromStorage();
    expect(storage.state).toEqual(stateLoadedFromDefault);
  });
  var wasResetCallbackCalled = false;
  it('* Reset works just like load from C.DEFAULT_LOAD_STATE', (done) => {
    // reseting the state and loading should be the same as the
    // C.DEFAULT_LOAD_STATE.
    storage.reset().then(() => {
      wasResetCallbackCalled = true;
      expect(storage.state.options).toEqual(C.DEFAULT_LOAD_STATE.options);
      expect(storage.state.roster).toEqual(C.DEFAULT_LOAD_STATE.roster);
      expect(storage.state.instances).toEqual(C.DEFAULT_LOAD_STATE.instances);
    }).then(done);
  });
  */
});  // state-storage
