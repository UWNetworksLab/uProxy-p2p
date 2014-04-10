// Meets specification:
// * src/interfaces/consent.d.ts

// Consent is REQUESTED by the receiver and OFFERD by the giver; when consent is
// requested and offered, then it is GRANTED. Before either have happened, the
// state is NONE. IGNORE_XXX actions can happen by the side that has not taken
// any action. This puts the state into the IGNORED state.
//
// IGNORE states are particularly important when we want to work with an
// external proxy that auto requests or offers access. e.g. Tor does both and
// Psiphon always offers. The user wants to be able to be able to ignore these
// services offer/request.
module Consent {
  // The different state's that uproxy consent can be in w.r.t. a peer. These
  // are the values that get receieved or sent on the wire.
  export interface State {
    isRequesting:boolean;
    isOffering:boolean;
  }
  // Action taken by the user. These values are not on the wire. They are passed
  // as messaged from the UI to the core. They correspond to the different
  // buttons that the user may be clicking on.
  export enum UserAction {
    // Actions made by user w.r.t. remote as a proxy (changes ProxyState) or
    REQUEST, CANCEL_REQUEST, ACCEPT_OFFER, IGNORE_OFFER,
    // Actions made by user w.r.t. remote as a client (changes ClientState)
    OFFER, CANCEL_OFFER, ALLOW_REQUEST, IGNORE_REQUEST
  }
  // User-level consent state for a remote instance to be a proxy client for the
  // user. This state is stored in local storage for each instance ID we know
  // of.
  export enum ClientState {
    NONE, USER_OFFERED, REMOTE_REQUESTED, USER_IGNORED_REQUEST, GRANTED
  }
  export module ClientState {
    // Get the user's request state to send to the remote from the proxyState
    // value.
    export function userIsOffering(clientState:ClientState) : boolean {
      switch(clientState){
        case ClientState.NONE:
        case ClientState.REMOTE_REQUESTED:
        case ClientState.USER_IGNORED_REQUEST:
          return false;
        case ClientState.USER_OFFERED:
        case ClientState.GRANTED:
          return true;
      }
    }
    export function remoteIsRequesting(clientState:ClientState) : boolean {
      switch(clientState){
        case ClientState.NONE:
        case ClientState.USER_OFFERED:
          return false;
        case ClientState.USER_IGNORED_REQUEST:
        case ClientState.REMOTE_REQUESTED:
        case ClientState.GRANTED:
          return true;
      }
    }
  }

  // User-level consent state for a remote instance to be a proxy server for the
  // user.
  export enum ProxyState {
    NONE, USER_REQUESTED, REMOTE_OFFERED, USER_IGNORED_OFFER, GRANTED
  }
  export module ProxyState {
    // Get the user's request state to send to the remote from the proxyState
    // value.
    export function userIsRequesting(proxyState:ProxyState) : boolean {
      switch(proxyState){
        case ProxyState.NONE:
        case ProxyState.REMOTE_OFFERED:
        case ProxyState.USER_IGNORED_OFFER:
          return false;
        case ProxyState.USER_REQUESTED:
        case ProxyState.GRANTED:
          return true;
      }
    }
    export function remoteIsOffering(proxyState:ProxyState) : boolean {
      switch(proxyState){
        case ProxyState.NONE:
        case ProxyState.USER_REQUESTED:
          return false;
        case ProxyState.USER_IGNORED_OFFER:
        case ProxyState.REMOTE_OFFERED:
        case ProxyState.GRANTED:
          return true;
      }
    }
  }


}

//------------------------------------------------------------------------------
// The State-Action Tranditions
//------------------------------------------------------------------------------
// For conciseness, we use |t| for the state-action transition table. The
// |number| in this types are |ProxyState| or |ClientState| (easily
// distinguished by context), but typescript is not smart enough to remember
// that an enum-typed value is a subtype of number, so we have to use |number|
// for now. TODO: this should be the typing: but TypeScript is being broken. We
// should add a typescript bug number here.

//------------------------------------------------------------------------------
// Actions by the user w.r.t. the remote instance as a proxy.
module Consent {
  var t:{[proxyState:number]:{[userAction:number]:ProxyState}} = {};
  var S = ProxyState;
  var A = UserAction;
  t[S.NONE]               [A.REQUEST]        = S.USER_REQUESTED;
  t[S.USER_REQUESTED]     [A.CANCEL_REQUEST] = S.NONE;
  t[S.REMOTE_OFFERED]     [A.ACCEPT_OFFER]   = S.GRANTED;
  t[S.REMOTE_OFFERED]     [A.IGNORE_OFFER]   = S.USER_IGNORED_OFFER;
  t[S.USER_IGNORED_OFFER] [A.ACCEPT_OFFER]   = S.GRANTED;
  t[S.GRANTED]            [A.CANCEL_REQUEST] = S.REMOTE_OFFERED;
  export function userActionOnProxyState(
      action:UserAction, state:ProxyState) : ProxyState {
    return t[state][action];
  }
}

//------------------------------------------------------------------------------
// Actions made by the user w.r.t. remote as a client.
module Consent {
  var t:{[clientState:number]:{[userAction:number]:ClientState}} = {};
  var S = ClientState;
  var A = UserAction;
  t[S.NONE]                 [A.OFFER]          = S.USER_OFFERED;
  t[S.USER_OFFERED]         [A.CANCEL_OFFER]   = S.NONE;
  t[S.REMOTE_REQUESTED]     [A.ALLOW_REQUEST]  = S.GRANTED;
  t[S.REMOTE_REQUESTED]     [A.IGNORE_REQUEST] = S.USER_IGNORED_REQUEST;
  t[S.USER_IGNORED_REQUEST] [A.OFFER]          = S.GRANTED;
  t[S.GRANTED]              [A.CANCEL_OFFER]   = S.REMOTE_REQUESTED;
  export function userActionOnClientState(
      action:UserAction, state:ClientState) : ClientState {
    return t[state][action];
  }
}

//------------------------------------------------------------------------------
// Update consent state of the remote as a proxy for the user given new consent
// bits from remote.
module Consent {
  var t:{[proxyState:number]:{[remoteIsOffering:number]:ProxyState}} = {};
  var State = ProxyState;
  // Current state          remoteIsOffering => New state
  t[ProxyState.NONE]              [0]        = ProxyState.REMOTE_OFFERED
  t[ProxyState.NONE]              [1]        = ProxyState.NONE;

  t[ProxyState.REMOTE_OFFERED]    [0]        = ProxyState.NONE;
  t[ProxyState.REMOTE_OFFERED]    [1]        = ProxyState.REMOTE_OFFERED;

  t[ProxyState.USER_REQUESTED]    [0]        = ProxyState.USER_REQUESTED;
  t[ProxyState.USER_REQUESTED]    [1]        = ProxyState.GRANTED;

  // Note: to force a user to see a request they have ignored, the remote can
  // cancel their offer and offer again. At the end of the day, if someone
  // is being too annoying, you can remove them from your contact list. Unclear
  // we can do better than this.
  t[ProxyState.USER_IGNORED_OFFER][0]        = ProxyState.NONE;
  t[ProxyState.USER_IGNORED_OFFER][1]        = ProxyState.USER_IGNORED_OFFER;

  t[ProxyState.GRANTED]           [0]        = ProxyState.USER_REQUESTED;
  t[ProxyState.GRANTED]           [1]        = ProxyState.GRANTED;

  export function updateProxyStateFromRemoteState(
      remoteState:State, state:ProxyState) : ProxyState {
    return t[state][+remoteState.isOffering];
  }
}

//------------------------------------------------------------------------------
// Update consent state of the remote as a proxy for the user given new consent
// bits from remote.
module Consent {
  var t:{[clientState:number]:{[remoteIsRequesting:number]:ClientState}} = {};
  // Current state        remoteIsOffering => New state
  t[ClientState.NONE]                [0]   = ClientState.NONE;
  t[ClientState.NONE]                [1]   = ClientState.REMOTE_REQUESTED;

  t[ClientState.REMOTE_REQUESTED]    [0]   = ClientState.NONE;
  t[ClientState.REMOTE_REQUESTED]    [1]   = ClientState.REMOTE_REQUESTED;

  t[ClientState.USER_OFFERED]        [0]   = ClientState.USER_OFFERED;
  t[ClientState.USER_OFFERED]        [1]   = ClientState.GRANTED;

  // Note: to force a user to see a request they have ignored, the remote can
  // cancel their request and request again. At the end of the day, if someone
  // is being too annoying, you can remove them from your contact list. Unclear
  // we can do better than this.
  t[ClientState.USER_IGNORED_REQUEST][0]   = ClientState.NONE;
  t[ClientState.USER_IGNORED_REQUEST][1]   = ClientState.USER_IGNORED_REQUEST;

  t[ClientState.GRANTED]             [0]   = ClientState.USER_OFFERED;
  t[ClientState.GRANTED]             [1]   = ClientState.GRANTED;

  export function updateClientStateFromRemoteState(
      remoteState:State, state:ClientState) : ClientState {
    return t[state][+remoteState.isRequesting];
  }
}
