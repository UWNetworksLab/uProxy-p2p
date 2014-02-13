// This module meets the specification in consent.d.ts.

// Consent is REQUESTED by the receiver and OFFERD by the giver; when consent is requested and
// offered, then it is GRANTED. Before either have happened, the state is NONE. IGNORE_XXX
// actions can happen by the side that has not taken any action. This puts the state into the
// IGNORED state.

module Consent {
  // The different state's that uproxy consent can be in w.r.t. a peer. These are the values that
  // get receieved or sent on the wire.
  export interface State {
    isRequesting : boolean;
    isOffering : boolean;
  }
  // Action taken by the user. These values are not on the wire. They are passed as messaged from
  // the UI to the core. They correspond to the different buttons that the user may be clicking
  // on.
  export enum UserAction {
    // Actions made by user w.r.t. remote as a proxy, or
    REQUEST, CANCEL_REQUEST, ACCEPT_OFFER, IGNORE_OFFER,
    // Actions made by user w.r.t. remote as a client, or
    OFFER, CANCEL_OFFER, ALLOW_REQUEST, IGNORE_REQUEST
  }
  // User-level consent state for a remote instance to be a proxy client for the user. This state
  // is stored in local storage for each instance ID we know of.
  export enum ClientState {
    NONE, USER_OFFERED, REMOTE_REQUESTED, USER_IGNORED_REQUEST, GRANTED
  }
  export module ClientState {
    // Get the user's request state to send to the remote from the proxyState value.
    export function userIsOffering(clientState : ClientState) : boolean {
      switch(clientState){
        case NONE:
        case REMOTE_REQUESTED:
        case USER_IGNORED_REQUEST:
          return false;
        case USER_OFFERED:
        case GRANTED:
          return true;
      }
    }
    export function remoteIsRequesting(clientState : ClientState) : boolean {
      switch(clientState){
        case NONE:
        case USER_OFFERED:
          return false;
        case USER_IGNORED_REQUEST:
        case REMOTE_REQUESTED:
        case GRANTED:
          return true;
      }
    }
  }

  // User-level consent state for a remote instance to be a proxy server for the user.
  export enum ProxyState {
    NONE, USER_REQUESTED, REMOTE_OFFERED, USER_IGNORED_OFFER, GRANTED
  }
  export module ProxyState {
    // Get the user's request state to send to the remote from the proxyState value.
    export function userIsRequesting(proxyState : ProxyState) : boolean {
      switch(proxyState){
        case NONE:
        case REMOTE_OFFERED:
        case USER_IGNORED_OFFER:
          return false;
        case USER_REQUESTED:
        case GRANTED:
          return true;
      }
    }
    export function remoteIsOffering(proxyState : ProxyState) : boolean {
      switch(proxyState){
        case NONE:
        case USER_REQUESTED:
          return false;
        case USER_IGNORED_OFFER:
        case REMOTE_OFFERED:
        case GRANTED:
          return true;
      }
    }
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
  var t : {[proxyState : number]: { [remoteIsOffering : number]:ProxyState } } = {};
  // var t : {[s : ProxyState]: { [r : State]:ProxyState } } = {};
  // Current state          remoteIsOffering       = New state
  t[ProxyState.NONE]              [0]              = ProxyState.REMOTE_OFFERED
  t[ProxyState.NONE]              [1]              = ProxyState.NONE;

  t[ProxyState.REMOTE_OFFERED]    [0]              = ProxyState.NONE;
  t[ProxyState.REMOTE_OFFERED]    [1]              = ProxyState.REMOTE_OFFERED;

  t[ProxyState.USER_REQUESTED]    [0]              = ProxyState.USER_REQUESTED;
  t[ProxyState.USER_REQUESTED]    [1]              = ProxyState.GRANTED;

  // Note: to force a user to see a request they have ignored, the remote can cancel their request
  // and request again. At the end of the day, if someone is being too annoying, you can remove
  // them from your contact list. Unclear we can do better than this.
  t[ProxyState.USER_IGNORED_OFFER][0]              = ProxyState.NONE;
  t[ProxyState.USER_IGNORED_OFFER][1]              = ProxyState.USER_IGNORED_OFFER;

  t[ProxyState.GRANTED]           [0]              = ProxyState.USER_REQUESTED;
  t[ProxyState.GRANTED]           [1]              = ProxyState.GRANTED;

  export function updateProxyStateFromRemoteState(remoteState : State, state : ProxyState)
      : ProxyState {
    return t[state][+remoteState.isOffering];
  }
}

//-------------------------------------------------------------------------------------------------
// Update consent state of the remote as a proxy for the user given new consent bits from remote.
module Consent {
  // Use |t| as local var for readability.
  var t : {[clientState: number]: { [remoteIsRequesting : number]:ClientState } } = {};
  // var t : {[s: ClientState]: { [r : State]:ClientState } } = {};
  // Current state            remoteIsOffering     = New state
  t[ClientState.NONE]                 [0]          = ClientState.NONE;
  t[ClientState.NONE]                 [1]          = ClientState.REMOTE_REQUESTED;

  t[ClientState.REMOTE_REQUESTED]     [0]          = ClientState.NONE;
  t[ClientState.REMOTE_REQUESTED]     [1]          = ClientState.REMOTE_REQUESTED;

  t[ClientState.USER_OFFERED]         [0]          = ClientState.USER_OFFERED;
  t[ClientState.USER_OFFERED]         [1]          = ClientState.GRANTED;

  // Note: to force a user to see a request they have ignored, the remote can cancel their request
  // and request again. At the end of the day, if someone is being too annoying, you can remove
  // them from your contact list. Unclear we can do better than this.
  t[ClientState.USER_IGNORED_REQUEST] [0]          = ClientState.NONE;
  t[ClientState.USER_IGNORED_REQUEST] [1]          = ClientState.USER_IGNORED_REQUEST;

  t[ClientState.GRANTED]              [0]          = ClientState.USER_OFFERED;
  t[ClientState.GRANTED]              [1]          = ClientState.GRANTED;

  export function updateClientStateFromRemoteState(remoteState : State, state : ClientState)
      : ClientState {
    return t[state][+remoteState.isRequesting];
  }
}
