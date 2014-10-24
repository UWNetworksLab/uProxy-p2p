/// <reference path='util.ts' />

module Consent {
  // The different states that uProxy consent can be in w.r.t. a peer. These
  // are the values that get sent or received on the wire.
  export interface WireState {
    isRequesting :boolean;
    isOffering   :boolean;
  }

  // Action taken by the user. These values are not on the wire. They are passed
  // in messages from the UI to the core. They correspond to the different
  // buttons that the user may be clicking on.
  export enum UserAction {
    // Actions made by user w.r.t. remote as a proxy
    REQUEST = 5000, CANCEL_REQUEST, IGNORE_OFFER, UNIGNORE_OFFER,
    // Actions made by user w.r.t. remote as a client
    OFFER = 5100, CANCEL_OFFER, IGNORE_REQUEST, UNIGNORE_REQUEST,
  }

  // User-level consent state w.r.t. a remote instance. This state is stored
  // in local storage for each instance ID we know of.
  export class State {
    // Local user's relationship with remote instance.
    // key security property: controls local user giving access to peer
    _localGrantsAccessToRemote :boolean;
    _localRequestsAccessFromRemote :boolean;

    // Cached values from remote user's instance sent over signalling channel.
    remoteGrantsAccessToLocal :boolean;
    remoteRequestsAccessFromLocal :boolean;

    // Local user's UI controls for remote requests and offers.
    // Invariants: If localGrantsAccessToRemote is true,
    // ignoringRemoteUserRequest must be false. If
    // localRequestsAccessFromRemote is true, ignoringRemoteUserOffer
    // must be false.
    ignoringRemoteUserRequest :boolean;
    ignoringRemoteUserOffer :boolean;

    constructor() {
      this._localGrantsAccessToRemote = false;
      this._localRequestsAccessFromRemote = false;
      this.remoteGrantsAccessToLocal = false;
      this.remoteRequestsAccessFromLocal = false;
      this.ignoringRemoteUserRequest = false;
      this.ignoringRemoteUserOffer = false;
    }

    // TODO(jetpack): what about setting ignoring* vals to true when
    // corresponding _local* vals are already true? we could:
    // - set the _local* val to false
    // - ignore attempt to set ignoring* val
    // - allow ignoring* to be true when _local* is true

    // setters to guarantee invariants
    public get localGrantsAccessToRemote() :boolean {
      return this._localGrantsAccessToRemote;
    }
    public set localGrantsAccessToRemote(granted :boolean) {
      this._localGrantsAccessToRemote = granted;
      if (granted)
        this.ignoringRemoteUserRequest = false;
    }
    public get localRequestsAccessFromRemote() :boolean {
      return this._localRequestsAccessFromRemote;
    }
    public set localRequestsAccessFromRemote(requested :boolean) {
      this._localRequestsAccessFromRemote = requested;
      if (requested)
        this.ignoringRemoteUserOffer = false;
    }
  }

  export function updateStateFromRemoteState(state :State, remoteState :WireState) {
    state.remoteRequestsAccessFromLocal = remoteState.isRequesting;
    state.remoteGrantsAccessToLocal = remoteState.isOffering;
  }

  // Returns false on invalid actions.
  export function handleUserAction(state :State, action :UserAction) :boolean {
    switch(action) {
      case UserAction.OFFER:
        state.localGrantsAccessToRemote = true;
        break;
      case UserAction.CANCEL_OFFER:
        state.localGrantsAccessToRemote = false;
        break;
      case UserAction.IGNORE_REQUEST:
        state.ignoringRemoteUserRequest = true;
        break;
      case UserAction.UNIGNORE_REQUEST:
        state.ignoringRemoteUserRequest = false;
        break;
      case UserAction.REQUEST:
        state.localRequestsAccessFromRemote = true;
        break;
      case UserAction.CANCEL_REQUEST:
        state.localRequestsAccessFromRemote = false;
        break;
      case UserAction.IGNORE_OFFER:
        state.ignoringRemoteUserOffer = true;
        break;
      case UserAction.UNIGNORE_OFFER:
        state.ignoringRemoteUserOffer = false;
        break;
      default:
        console.warn('Invalid Consent.UserAction! ' + action);
        return false;
    }
    return true;
  }
}
