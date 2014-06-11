/// <reference path='util.ts' />

// Consent is REQUESTED by the receiver and OFFERED by the giver; when consent
// is requested and offered, then it is GRANTED. Before either has happened,
// the state is NONE. IGNORE_XXX actions can happen by the side that has not
// taken any action. This puts the state into the IGNORED state.
//
// TODO: Correct the statement above. There is no "IGNORED" state.
//
// IGNORE_XXX states are particularly important when we want to work with an
// external proxy that auto-requests or auto-offers access. E.g., Tor does both
// and Psiphon always offers. The user wants to be able to be able to ignore
// these services' offers/requests.
module Consent {

  // The different states that uProxy consent can be in w.r.t. a peer. These
  // are the values that get receieved or sent on the wire.
  export interface State {
    isRequesting :boolean;
    isOffering   :boolean;
  }

  // Action taken by the user. These values are not on the wire. They are passed
  // in messages from the UI to the core. They correspond to the different
  // buttons that the user may be clicking on.
  export enum UserAction {
    // Actions made by user w.r.t. remote as a proxy (changes ProxyState) or
    REQUEST = 5000, CANCEL_REQUEST, ACCEPT_OFFER, IGNORE_OFFER,
    // Actions made by user w.r.t. remote as a client (changes ClientState)
    OFFER = 5100, CANCEL_OFFER, ALLOW_REQUEST, IGNORE_REQUEST
  }

  // User-level consent state for a remote instance to be a proxy client for the
  // user. This state is stored in local storage for each instance ID we know
  // of.
  export enum ClientState {
    NONE = 6000, USER_OFFERED, REMOTE_REQUESTED, USER_IGNORED_REQUEST, GRANTED
  }

  export module ClientState {
    // Gets the user's request state to send to the remote from the clientState
    // value.
    export function userIsOffering(clientState:ClientState) : boolean {
      switch (clientState) {
        case ClientState.NONE:
        case ClientState.REMOTE_REQUESTED:
        case ClientState.USER_IGNORED_REQUEST:
          return false;
        case ClientState.USER_OFFERED:
        case ClientState.GRANTED:
          return true;
        default:
          throw new Error(
              'Internal error: Unknown client state [' + clientState + ']');
      }
    }
    export function remoteIsRequesting(clientState:ClientState) : boolean {
      switch (clientState) {
        case ClientState.NONE:
        case ClientState.USER_OFFERED:
          return false;
        case ClientState.USER_IGNORED_REQUEST:
        case ClientState.REMOTE_REQUESTED:
        case ClientState.GRANTED:
          return true;
        default:
          throw new Error(
              'Internal error: Unknown client state [' + clientState + ']');
      }
    }
  }

  // User-level consent state for a remote instance to be a proxy server for the
  // user.
  export enum ProxyState {
    NONE = 6100, USER_REQUESTED, REMOTE_OFFERED, USER_IGNORED_OFFER, GRANTED
  }

  export module ProxyState {
    // Gets the user's request state to send to the remote from the proxyState
    // value.
    export function userIsRequesting(proxyState:ProxyState) : boolean {
      switch (proxyState) {
        case ProxyState.NONE:
        case ProxyState.REMOTE_OFFERED:
        case ProxyState.USER_IGNORED_OFFER:
          return false;
        case ProxyState.USER_REQUESTED:
        case ProxyState.GRANTED:
          return true;
        default:
          throw new Error(
              'Internal error: Unknown proxy state [' + proxyState + ']');
      }
    }
    export function remoteIsOffering(proxyState:ProxyState) : boolean {
      switch (proxyState) {
        case ProxyState.NONE:
        case ProxyState.USER_REQUESTED:
          return false;
        case ProxyState.USER_IGNORED_OFFER:
        case ProxyState.REMOTE_OFFERED:
        case ProxyState.GRANTED:
          return true;
        default:
          throw new Error(
              'Internal error: Unknown proxy state [' + proxyState + ']');
      }
    }
  }

}

//------------------------------------------------------------------------------
// The State-Action Transitions
//------------------------------------------------------------------------------
// See util.ts for the Finite State Machine implementation.

//------------------------------------------------------------------------------
// Actions by the user w.r.t. the remote instance as a proxy.
module Consent {
  var fsm = new FSM<ProxyState, UserAction>();
  var S = ProxyState;
  var A = UserAction;
  fsm.set(S.NONE,               A.REQUEST,        S.USER_REQUESTED);
  fsm.set(S.USER_REQUESTED,     A.CANCEL_REQUEST, S.NONE);
  fsm.set(S.REMOTE_OFFERED,     A.REQUEST,        S.GRANTED);
  fsm.set(S.REMOTE_OFFERED,     A.ACCEPT_OFFER,   S.GRANTED);
  fsm.set(S.REMOTE_OFFERED,     A.IGNORE_OFFER,   S.USER_IGNORED_OFFER);
  fsm.set(S.USER_IGNORED_OFFER, A.ACCEPT_OFFER,   S.GRANTED);
  fsm.set(S.GRANTED,            A.CANCEL_REQUEST, S.REMOTE_OFFERED);
  export function userActionOnProxyState(
      action:UserAction, state:ProxyState) : ProxyState {
    return fsm.get(state, action);
  }
}

//------------------------------------------------------------------------------
// Actions made by the user w.r.t. the remote instance as a client.
module Consent {
  var fsm = new FSM<ClientState, UserAction>();
  var S = ClientState;
  var A = UserAction;
  fsm.set(S.NONE,                 A.OFFER,          S.USER_OFFERED);
  fsm.set(S.USER_OFFERED,         A.CANCEL_OFFER,   S.NONE);
  fsm.set(S.REMOTE_REQUESTED,     A.OFFER,          S.GRANTED);
  fsm.set(S.REMOTE_REQUESTED,     A.ALLOW_REQUEST,  S.GRANTED);
  fsm.set(S.REMOTE_REQUESTED,     A.IGNORE_REQUEST, S.USER_IGNORED_REQUEST);
  fsm.set(S.USER_IGNORED_REQUEST, A.ALLOW_REQUEST,  S.GRANTED);
  fsm.set(S.GRANTED,              A.CANCEL_OFFER,   S.REMOTE_REQUESTED);
  export function userActionOnClientState(
      action:UserAction, state:ClientState) : ClientState {
    return fsm.get(state, action);
  }
}

//------------------------------------------------------------------------------
// Update consent state of the remote as a proxy for the user given new consent
// bits from remote.
module Consent {
  var fsm = new FSM<ProxyState, number>();
  // Current state    --- remoteIsOffering --->  New state
  fsm.set(ProxyState.NONE,               0,        ProxyState.NONE);
  fsm.set(ProxyState.NONE,               1,        ProxyState.REMOTE_OFFERED);

  fsm.set(ProxyState.REMOTE_OFFERED,     0,        ProxyState.NONE);
  fsm.set(ProxyState.REMOTE_OFFERED,     1,        ProxyState.REMOTE_OFFERED);

  fsm.set(ProxyState.USER_REQUESTED,     0,        ProxyState.USER_REQUESTED);
  fsm.set(ProxyState.USER_REQUESTED,     1,        ProxyState.GRANTED);

  // Note: to force a user to see a request they have ignored, the remote can
  // cancel their offer and offer again. At the end of the day, if someone
  // is being too annoying, you can remove them from your contact list. Unclear
  // we can do better than this.
  fsm.set(ProxyState.USER_IGNORED_OFFER, 0,        ProxyState.NONE);
  fsm.set(ProxyState.USER_IGNORED_OFFER, 1,        ProxyState.USER_IGNORED_OFFER);

  fsm.set(ProxyState.GRANTED,            0,        ProxyState.USER_REQUESTED);
  fsm.set(ProxyState.GRANTED,            1,        ProxyState.GRANTED);

  export function updateProxyStateFromRemoteState(
      remoteState:State, state:ProxyState) : ProxyState {
    return fsm.get(state, +remoteState.isOffering);
  }
}

//------------------------------------------------------------------------------
// Update consent state of the remote as a client for the user given new consent
// bits from remote.
module Consent {
  var fsm = new FSM<ClientState, number>();
  // Current state    --- remoteIsRequesting --->  New state
  fsm.set(ClientState.NONE,                0,   ClientState.NONE);
  fsm.set(ClientState.NONE,                1,   ClientState.REMOTE_REQUESTED);

  fsm.set(ClientState.REMOTE_REQUESTED,    0,   ClientState.NONE);
  fsm.set(ClientState.REMOTE_REQUESTED,    1,   ClientState.REMOTE_REQUESTED);

  fsm.set(ClientState.USER_OFFERED,        0,   ClientState.USER_OFFERED);
  fsm.set(ClientState.USER_OFFERED,        1,   ClientState.GRANTED);

  // Note: to force a user to see a request they have ignored, the remote can
  // cancel their request and request again. At the end of the day, if someone
  // is being too annoying, you can remove them from your contact list. Unclear
  // we can do better than this.
  fsm.set(ClientState.USER_IGNORED_REQUEST,0,   ClientState.NONE);
  fsm.set(ClientState.USER_IGNORED_REQUEST,1,   ClientState.USER_IGNORED_REQUEST);

  fsm.set(ClientState.GRANTED,             0,   ClientState.USER_OFFERED);
  fsm.set(ClientState.GRANTED,             1,   ClientState.GRANTED);

  export function updateClientStateFromRemoteState(
      remoteState:State, state:ClientState) : ClientState {
    return fsm.get(state, +remoteState.isRequesting);
  }
}
