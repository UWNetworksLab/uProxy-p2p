// This module meets the specification in consent.d.ts.

// Consent is REQUESTED by the receiver and OFFERD by the giver; when consent is requested and
// offered, then it is GRANTED. Before either have happened, the state is NONE. IGNORE_XXX
// actions can happen by the side that has not taken any action. This puts the state into the
// IGNORED state.

module Consent {
  // Action taken by the remote instance. These values are on the wire, so we need to distinguish
  // the values for the remote as client vs proxy. i.e. we cannot have two enums.
  export enum RemoteState {
    NONE, REQUESTING, OFFERING, BOTH
  }
  // Action taken by the user. These values are on the wire, so we need to distinguish
  // the values for the remote as client vs proxy. i.e. we cannot have two enums.
  export enum UserAction {
    // Actions made by user w.r.t. remote as a proxy, or
    REQUEST, CANCEL_REQUEST, ACCEPT_OFFER, IGNORE_OFFER,
    // Actions made by user w.r.t. remote as a client, or
    OFFER, CANCEL_OFFER, ALLOW_REQUEST, IGNORE_REQUEST
  }
  // User-level consent state for a remote instance to be proxy client for the user.
  export enum ClientState {
    NONE, USER_OFFERED, REMOTE_REQUESTED, USER_IGNORED_REQUEST, GRANTED
  }
  // User-level consent state for a remote instance to be a proxy server for the user.
  export enum ProxyState {
    NONE, USER_REQUESTED, REMOTE_OFFERED, USER_IGNORED_OFFER, GRANTED
  }
}

//-------------------------------------------------------------------------------------------------
// Actions by the user w.r.t. the remote instance as a proxy.
module Consent {
  // interface ActionToPoxyState { [a : UserAction] : ProxyState }

  // Use |t| as local var for readability.
  var t : { [proxyState : number]: { [userAction : number] : ProxyState } } = {};
  // TODO: this should be the typing: but TypeScript is being broken.
  // var t : { [s : ProxyState]: { [a : UserAction] : ProxyState } } = {};
  t[ProxyState.NONE]              [UserAction.REQUEST]       = ProxyState.USER_REQUESTED;
  t[ProxyState.USER_REQUESTED]    [UserAction.CANCEL_REQUEST]= ProxyState.NONE;
  t[ProxyState.REMOTE_OFFERED]    [UserAction.ACCEPT_OFFER]  = ProxyState.GRANTED;
  t[ProxyState.REMOTE_OFFERED]    [UserAction.IGNORE_OFFER]  = ProxyState.USER_IGNORED_OFFER;
  t[ProxyState.USER_IGNORED_OFFER][UserAction.ACCEPT_OFFER]  = ProxyState.GRANTED;
  t[ProxyState.GRANTED]           [UserAction.CANCEL_REQUEST]= ProxyState.REMOTE_OFFERED;

  export function userActionOnProxyState(action : UserAction, state : ProxyState)
      : ProxyState {
    return t[state][action];
  }
}

//-------------------------------------------------------------------------------------------------
// Actions made by the user w.r.t. remote as a client.
module Consent {
  // Use |t| as local var for readability of transitions.
  var t : {[clientState : number] : { [userAction: number]:ClientState } } = {};
  // var t : {[s : ClientState] : { [a: UserAction]:ClientState } } = {};
  t[ClientState.NONE]                [UserAction.OFFER]         = ClientState.USER_OFFERED;
  t[ClientState.USER_OFFERED]        [UserAction.CANCEL_OFFER]  = ClientState.NONE;
  t[ClientState.REMOTE_REQUESTED]    [UserAction.ALLOW_REQUEST] = ClientState.GRANTED;
  t[ClientState.REMOTE_REQUESTED]    [UserAction.IGNORE_REQUEST]= ClientState.USER_IGNORED_REQUEST;
  t[ClientState.USER_IGNORED_REQUEST][UserAction.OFFER]         = ClientState.GRANTED;
  t[ClientState.GRANTED]             [UserAction.CANCEL_OFFER]  = ClientState.REMOTE_REQUESTED;
  export function userActionOnClientState(action : UserAction, state : ClientState)
      : ClientState {
    return t[state][action];
  }
}

//-------------------------------------------------------------------------------------------------
// Update consent state of the remote as a proxy for the user given new consent bits from remote.
module Consent {
  // Use |t| as local var for readability.
  var t : {[proxyState : number]: { [remoteState : number]:ProxyState } } = {};
  // var t : {[s : ProxyState]: { [r : RemoteState]:ProxyState } } = {};
  t[ProxyState.NONE]              [RemoteState.NONE]         = ProxyState.NONE;
  t[ProxyState.NONE]              [RemoteState.REQUESTING]   = ProxyState.NONE;
  t[ProxyState.NONE]              [RemoteState.OFFERING]     = ProxyState.REMOTE_OFFERED;
  t[ProxyState.NONE]              [RemoteState.BOTH]         = ProxyState.REMOTE_OFFERED;

  t[ProxyState.REMOTE_OFFERED]    [RemoteState.NONE]         = ProxyState.NONE;
  t[ProxyState.REMOTE_OFFERED]    [RemoteState.REQUESTING]   = ProxyState.NONE;
  t[ProxyState.REMOTE_OFFERED]    [RemoteState.OFFERING]     = ProxyState.REMOTE_OFFERED;
  t[ProxyState.REMOTE_OFFERED]    [RemoteState.BOTH]         = ProxyState.REMOTE_OFFERED;

  t[ProxyState.USER_REQUESTED]    [RemoteState.NONE]         = ProxyState.USER_REQUESTED;
  t[ProxyState.USER_REQUESTED]    [RemoteState.REQUESTING]   = ProxyState.USER_REQUESTED;
  t[ProxyState.USER_REQUESTED]    [RemoteState.OFFERING]     = ProxyState.GRANTED;
  t[ProxyState.USER_REQUESTED]    [RemoteState.BOTH]         = ProxyState.GRANTED;

  // Note: to force a user to see a request they have ignored, the remote can cancel their request
  // and request again. At the end of the day, if someone is being too annoying, you can remove
  // them from your contact list. Unclear we can do better than this.
  t[ProxyState.USER_IGNORED_OFFER][RemoteState.NONE]         = ProxyState.NONE;
  t[ProxyState.USER_IGNORED_OFFER][RemoteState.REQUESTING]   = ProxyState.NONE;
  t[ProxyState.USER_IGNORED_OFFER][RemoteState.OFFERING]     = ProxyState.USER_IGNORED_OFFER;
  t[ProxyState.USER_IGNORED_OFFER][RemoteState.BOTH]         = ProxyState.USER_IGNORED_OFFER;

  t[ProxyState.GRANTED]           [RemoteState.NONE]         = ProxyState.USER_REQUESTED;
  t[ProxyState.GRANTED]           [RemoteState.REQUESTING]   = ProxyState.USER_REQUESTED;
  t[ProxyState.GRANTED]           [RemoteState.OFFERING]     = ProxyState.GRANTED;
  t[ProxyState.GRANTED]           [RemoteState.BOTH]         = ProxyState.GRANTED;

  export function updateProxyStateFromRemoteState(remoteState : RemoteState, state : ProxyState)
      : ProxyState {
    return t[state][remoteState];
  }
}

//-------------------------------------------------------------------------------------------------
// Update consent state of the remote as a proxy for the user given new consent bits from remote.
module Consent {
  // Use |t| as local var for readability.
  var t : {[clientState: number]: { [remoteState : number]:ClientState } } = {};
  // var t : {[s: ClientState]: { [r : RemoteState]:ClientState } } = {};
  t[ClientState.NONE]              [RemoteState.NONE]         = ClientState.NONE;
  t[ClientState.NONE]              [RemoteState.REQUESTING]   = ClientState.REMOTE_REQUESTED;
  t[ClientState.NONE]              [RemoteState.OFFERING]     = ClientState.NONE;
  t[ClientState.NONE]              [RemoteState.BOTH]         = ClientState.REMOTE_REQUESTED;

  t[ClientState.REMOTE_REQUESTED]  [RemoteState.NONE]         = ClientState.NONE;
  t[ClientState.REMOTE_REQUESTED]  [RemoteState.REQUESTING]   = ClientState.REMOTE_REQUESTED;
  t[ClientState.REMOTE_REQUESTED]  [RemoteState.OFFERING]     = ClientState.NONE;
  t[ClientState.REMOTE_REQUESTED]  [RemoteState.BOTH]         = ClientState.REMOTE_REQUESTED;

  t[ClientState.USER_OFFERED]      [RemoteState.NONE]         = ClientState.USER_OFFERED;
  t[ClientState.USER_OFFERED]      [RemoteState.REQUESTING]   = ClientState.GRANTED;
  t[ClientState.USER_OFFERED]      [RemoteState.OFFERING]     = ClientState.USER_OFFERED;
  t[ClientState.USER_OFFERED]      [RemoteState.BOTH]         = ClientState.GRANTED;

  // Note: to force a user to see a request they have ignored, the remote can cancel their request
  // and request again. At the end of the day, if someone is being too annoying, you can remove
  // them from your contact list. Unclear we can do better than this.
  t[ClientState.USER_IGNORED_REQUEST][RemoteState.NONE]       = ClientState.NONE;
  t[ClientState.USER_IGNORED_REQUEST][RemoteState.REQUESTING] = ClientState.USER_IGNORED_REQUEST;
  t[ClientState.USER_IGNORED_REQUEST][RemoteState.OFFERING]   = ClientState.NONE;
  t[ClientState.USER_IGNORED_REQUEST][RemoteState.BOTH]       = ClientState.USER_IGNORED_REQUEST;

  t[ClientState.GRANTED]           [RemoteState.NONE]         = ClientState.USER_OFFERED;
  t[ClientState.GRANTED]           [RemoteState.REQUESTING]   = ClientState.GRANTED;
  t[ClientState.GRANTED]           [RemoteState.OFFERING]     = ClientState.USER_OFFERED;
  t[ClientState.GRANTED]           [RemoteState.BOTH]         = ClientState.GRANTED;

  export function updateClientStateFromRemoteState(remoteState : RemoteState, state : ClientState)
      : ClientState {
    return t[state][remoteState];
  }
}
