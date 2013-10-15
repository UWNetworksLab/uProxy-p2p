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

  it("* Example states are not null", function() {
    expect(exampleState).not.toBe(null);
    expect(exampleSavedState).not.toBe(null);
  });
  it("* Initial state is default state", function() {
    expect(stateStorage.state).toEqual(DEFAULT_LOAD_STATE);
  });
  it("* Saving state doesn't change state", function() {
    // Make state a deep-copy of exampleState.
    stateStorage.state = cloneDeep(exampleState);
    // Saving state should should not change the state.
    stateStorage.saveStateToStorage();
    expect(stateStorage.state).toEqual(exampleState);
  });
  var stateReloadedDirectly;
  it("* Loading the saved state directly doesn't change anthing", function() {
    // Resetting the state, but loading the saved state should give the same
    // example state back.
    stateStorage.loadStateFromStorage();
    stateReloadedDirectly = cloneDeep(stateStorage.state);
    expect(Object.keys(stateReloadedDirectly.roster).length).toEqual(1);
    expect(stateReloadedDirectly).toEqual(exampleState);
  });
  var stateLoadedFromDefault;
  it("* Loading from DEAFAULT_LOAD_STATE has the same instances", function() {
    stateStorage.state = cloneDeep(DEFAULT_LOAD_STATE);
    stateStorage.loadStateFromStorage();
    stateLoadedFromDefault = cloneDeep(stateStorage.state);
    expect(stateLoadedFromDefault.instances)
        .toEqual(stateReloadedDirectly.instances);
  });
  it("* ... and 1 entry in the roster", function() {
    expect(Object.keys(stateLoadedFromDefault.roster).length).toEqual(1);
  });
  it("* ... but no clients for that entry.", function() {
    console.log("Roster: ", JSON.stringify(stateLoadedFromDefault.roster));
    var firstKey = (Object.keys(stateLoadedFromDefault.roster))[0];
    expect(stateLoadedFromDefault.roster[firstKey].clients).toEqual({});
  });
  var stateLoadedFromEmpty;
  it("* Loading from {} is same as default", function() {
    stateStorage.state = {};
    stateStorage.loadStateFromStorage();
    stateLoadedFromEmpty = cloneDeep(stateStorage.state);
    expect(stateLoadedFromEmpty).toEqual(stateLoadedFromDefault);
  });
  it("* Saving and loading again doesn't change anything", function() {
    // Saving and loading the same thing should not change the value of the
    // state.
    stateStorage.saveStateToStorage();
    stateStorage.loadStateFromStorage();
    expect(stateStorage.state).toEqual(stateLoadedFromDefault);
  });
  var wasResetCallbackCalled = false;
  it("* Reset works just like load from DEFAULT_LOAD_STATE", function() {
    // reseting the state and loading should be the same as the
    // DEFAULT_LOAD_STATE.
    stateStorage.reset(function() { wasResetCallbackCalled = true; });
    expect(stateStorage.state.options)
        .toEqual(stateLoadedFromDefault.options);
    expect(stateStorage.state.instances)
        .toEqual(stateLoadedFromDefault.instances);
    expect(stateStorage.state.roster)
        .toEqual(stateLoadedFromDefault.roster);
  });
  it("* ... and check reset callback was called.", function() {
    expect(wasResetCallbackCalled).toEqual(true);
  });
});  // util
