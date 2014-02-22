// Implemented by:
// * src/generic_core/uproxy_core/consent.ts

// Consent is REQUESTED by the receiver and OFFERD by the giver; when consent is
// requested and offered, then it is GRANTED. Before either have happened, the
// state is NONE. IGNORE_XXX actions can happen by the side that has not taken
// any action. This puts the state into the IGNORED state.

declare module Consent {
  // Action taken by the remote instance. These values are on the wire, so we
  // need to distinguish the values for the remote as client vs proxy. i.e. we
  // cannot have two enums.
  enum RemoteState {
    NONE, REQUESTING, OFFERING, BOTH
  }
  // Action taken by the user. These values are on the wire, so we need to
  // distinguish the values for the remote as client vs proxy. i.e. we cannot
  // have two enums.
  enum UserAction {
    // Actions made by user w.r.t. remote as a proxy, or
    REQUEST, CANCEL_REQUEST, ACCEPT_OFFER, IGNORE_OFFER,
    // Actions made by user w.r.t. remote as a client, or
    OFFER, CANCEL_OFFER, ALLOW_REQUEST, IGNORE_REQUEST
  }
  // User-level consent state for a remote instance to be proxy client for the
  // user.
  enum ClientState {
    NONE, USER_OFFERED, REMOTE_REQUESTED, USER_IGNORED_REQUEST, GRANTED
  }
  // User-level consent state for a remote instance to be a proxy server for the
  // user.
  enum ProxyState {
    NONE, USER_REQUESTED, REMOTE_OFFERED, USER_IGNORED_OFFER, GRANTED
  }

  function userActionOnProxyState(action:UserAction, state:ProxyState)
    : ProxyState
  function userActionOnClientState(action:UserAction, state:ClientState)
    : ClientState
  function updateProxyStateFromRemoteState(
      action:RemoteState, state:ProxyState) : ProxyState
  function updateClientStateFromRemoteState(
      action:RemoteState, state:ClientState) : ClientState
}
