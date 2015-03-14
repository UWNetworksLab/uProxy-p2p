module Consent {
  var log :Logging.Log = new Logging.Log('consent');

  export class State implements uProxy.ConsentState {
    // Whether I am requesting access from my friend or not.  This should
    // remain true even after my friend grants me access (to indicate that
    // I've accepted their access-grant, and that I should automatically
    // request access from new instances)
    localRequestsAccessFromRemote :boolean;

    // Whether I am granting access to my friend (granting access permissions
    // all of there instances).
    localGrantsAccessToRemote :boolean;

    // Whether my friend is requesting access through me.
    remoteRequestsAccessFromLocal :boolean;

    // Used by the UI to ignore requests and offers.
    ignoringRemoteUserRequest :boolean;
    ignoringRemoteUserOffer :boolean;

    constructor() {
      this.localRequestsAccessFromRemote = false;
      this.ignoringRemoteUserOffer = false;
      this.localGrantsAccessToRemote = false;
      this.remoteRequestsAccessFromLocal = false;
      this.ignoringRemoteUserRequest = false;
    }
  }

  // Returns false on invalid actions.
  export function handleUserAction(
      state :State, action :uProxy.ConsentUserAction) :boolean {
    switch(action) {
      case uProxy.ConsentUserAction.OFFER:
        state.localGrantsAccessToRemote = true;
        state.ignoringRemoteUserRequest = false;
        break;
      case uProxy.ConsentUserAction.CANCEL_OFFER:
        state.localGrantsAccessToRemote = false;
        break;
      case uProxy.ConsentUserAction.IGNORE_REQUEST:
        state.ignoringRemoteUserRequest = true;
        break;
      case uProxy.ConsentUserAction.UNIGNORE_REQUEST:
        state.ignoringRemoteUserRequest = false;
        break;
      case uProxy.ConsentUserAction.REQUEST:
        state.localRequestsAccessFromRemote = true;
        state.ignoringRemoteUserOffer = false;
        break;
      case uProxy.ConsentUserAction.CANCEL_REQUEST:
        state.localRequestsAccessFromRemote = false;
        break;
      case uProxy.ConsentUserAction.IGNORE_OFFER:
        state.ignoringRemoteUserOffer = true;
        break;
      case uProxy.ConsentUserAction.UNIGNORE_OFFER:
        state.ignoringRemoteUserOffer = false;
        break;
      default:
        log.warn('Invalid uProxy.ConsentUserAction', action);
        return false;
    }
    return true;
  }
}
