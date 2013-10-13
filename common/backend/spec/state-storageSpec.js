function readJsonFile(location) {
  var xhr = new XMLHttpRequest();
  xhr.open("get", location, false);
  xhr.overrideMimeType("text/json; charset=utf-8");
  xhr.send();
  return JSON.parse(xhr.responseText);
}

// Depends on the MockStoage that executes everything syncronously.
describe("state-storage", function() {
  var exampleState = readJsonFile("common/backend/test/example-state.json");
  var exampleSavedState = readJsonFile("common/backend/test/example-saved-state.json");
  var stateStorage = new UProxyState();

  it("Example states are not null", function() {
    expect(exampleState).not.toBe(null);
    expect(exampleSavedState).not.toBe(null);
  });
  it("Initial state is default state", function() {
    expect(stateStorage.state).toEqual(DEFAULT_LOAD_STATE);
  });
  it("Saving state doesn't change state", function() {
    // Make state a deep-copy of exampleState.
    stateStorage.state = cloneDeep(exampleState);
    // Saving state should should not change the state.
    stateStorage.saveStateToStorage();
    expect(stateStorage.state).toEqual(exampleState);
  });
  var stateReloadedDirectly;
  it("Loading the state drop live data, e.g. roster", function() {
    // Resetting the state, but loading the saved state should give the same
    // example state back.
    stateStorage.loadStateFromStorage();
    stateReloadedDirectly = stateStorage.state;
    expect(stateReloadedDirectly).toEqual(exampleState);
  });
  var stateLoadedFromDefault;
  it("Loading from DEAFAULT_LOAD_STATE != loading over state", function() {
    stateStorage.state = cloneDeep(DEFAULT_LOAD_STATE);
    stateStorage.loadStateFromStorage();
    stateLoadedFromDefault = stateStorage.state;
    expect(stateLoadedFromDefault).not.toEqual(stateReloadedDirectly);
  });
  it("Saving and loading again doesn't change anything", function() {
    // Saving and loading the same thing should not change the value of the
    // state.
    stateStorage.saveStateToStorage();
    stateStorage.loadStateFromStorage();
    expect(stateStorage.state).toEqual(stateLoadedFromDefault);
  });
  it("Reset works just like load from DEFAULT_LOAD_STATE", function() {
    // reseting the state and loading should be the same as the
    // DEFAULT_LOAD_STATE.
    stateStorage.reset();
    expect(stateStorage.state).toEqual(stateLoadedFromDefault);
  });
});  // util
