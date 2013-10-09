// validate insatnce

// TODO: Generalise to a simple type system & checker for JS.
function _validateStoredInstance(instanceId, instanceData) {
  var ids = [ // identity network:
              "name",
              "url",
              "userId",
              "network",
              // instance specific:
              "instanceId",
              "description",
              "keyHash",
              "trust"
            ];
  for (var i = 0; i < ids.length; ++i) {
    var id = ids[i];
    if (instanceData[id] === undefined) {
      log.debug("_validateStoredInstance: Rejecting instanceId " + instanceId + " for missing key " + id);
      return false;
    }
  }
  // TODO: use Trust enum.
  var testTrustValue = function(variable) {
    if (instanceData.trust[variable] === undefined) {
      return false;
    }
    var value = instanceData.trust[variable];
    if (value != "yes" && value != "no" && value != "requested" && value != "offered") {
      return false;
    }
    return true;
  };

  if (!testTrustValue('asProxy') || !testTrustValue('asClient')) {
    log.debug("_validateStoredInstance: Rejecting instanceId " + instanceId + " for trust value " +
        JSON.stringify(instanceData.trust));
    return false;
  }
  return true;
}
