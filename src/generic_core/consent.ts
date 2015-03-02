/// <reference path='util.ts' />

module Consent {
  // User-level consent state w.r.t. a remote instance. This state is stored
  // in local storage for each instance ID we know of.
  export class State implements uProxy.ConsentState {
    // Local user's relationship with remote instance.
    localGrantsAccessToRemote :boolean;
    localRequestsAccessFromRemote :boolean;

    // Cached values from remote user's instance sent over signalling channel.
    remoteGrantsAccessToLocal :boolean;
    remoteRequestsAccessFromLocal :boolean;

    // Local user's UI controls for remote requests and offers.
    ignoringRemoteUserRequest :boolean;
    ignoringRemoteUserOffer :boolean;

    constructor() {
      this.localGrantsAccessToRemote = false;
      this.localRequestsAccessFromRemote = false;
      this.remoteGrantsAccessToLocal = false;
      this.remoteRequestsAccessFromLocal = false;
      this.ignoringRemoteUserRequest = false;
      this.ignoringRemoteUserOffer = false;
    }

    // TODO(jetpack): what about setting ignoring* vals to true when
    // corresponding local* vals are already true? we could:
    // - set the local* val to false
    // - ignore attempt to set ignoring* val
    // - allow ignoring* to be true when local* is true
  }

  export function updateStateFromRemoteState(state :State, remoteState :uProxy.WireState) {
    state.remoteRequestsAccessFromLocal = remoteState.isRequesting;
    state.remoteGrantsAccessToLocal = remoteState.isOffering;
  }

  // Returns false on invalid actions.
  export function handleUserAction(state :State, action :uProxy.UserAction) :boolean {
    switch(action) {
      case uProxy.UserAction.OFFER:
        state.localGrantsAccessToRemote = true;
        state.ignoringRemoteUserRequest = false;
        break;
      case uProxy.UserAction.CANCEL_OFFER:
        state.localGrantsAccessToRemote = false;
        break;
      case uProxy.UserAction.IGNORE_REQUEST:
        state.ignoringRemoteUserRequest = true;
        break;
      case uProxy.UserAction.UNIGNORE_REQUEST:
        state.ignoringRemoteUserRequest = false;
        break;
      case uProxy.UserAction.REQUEST:
        state.localRequestsAccessFromRemote = true;
        state.ignoringRemoteUserOffer = false;
        break;
      case uProxy.UserAction.CANCEL_REQUEST:
        state.localRequestsAccessFromRemote = false;
        break;
      case uProxy.UserAction.IGNORE_OFFER:
        state.ignoringRemoteUserOffer = true;
        break;
      case uProxy.UserAction.UNIGNORE_OFFER:
        state.ignoringRemoteUserOffer = false;
        break;
      default:
        console.warn('Invalid uProxy.UserAction! ' + action);
        return false;
    }
    return true;
  }
}
