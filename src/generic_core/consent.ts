module Consent {
  var log :Logging.Log = new Logging.Log('consent');

  export class UserState implements uProxy.UserConsentState {
    // Requesting get access is per user.
    // If the user is requesting, this should remain true even after we have
    // been granted access to some remote-instances so that we automatically
    // request from new remote instances of the same user.
    localRequestsAccessFromRemote :boolean;

    // When I ignore an offer from Bob, I will ignore it for all instances.
    // This mirrors request access, where requesting from Bob is for all of
    // Bob's instances.
    ignoringRemoteUserOffer :boolean;

    // All sharing actions are per user.
    localGrantsAccessToRemote :boolean;
    remoteRequestsAccessFromLocal :boolean;
    ignoringRemoteUserRequest :boolean;

    constructor() {
      this.localRequestsAccessFromRemote = false;
      this.ignoringRemoteUserOffer = false;
      this.localGrantsAccessToRemote = false;
      this.remoteRequestsAccessFromLocal = false;
      this.ignoringRemoteUserRequest = false;
    }
  }

  // Returns false on invalid actions.
  export function handleUserAction(userState :UserState, action :uProxy.ConsentUserAction) :boolean {
    switch(action) {
      case uProxy.ConsentUserAction.OFFER:
        userState.localGrantsAccessToRemote = true;
        userState.ignoringRemoteUserRequest = false;
        break;
      case uProxy.ConsentUserAction.CANCEL_OFFER:
        userState.localGrantsAccessToRemote = false;
        break;
      case uProxy.ConsentUserAction.IGNORE_REQUEST:
        userState.ignoringRemoteUserRequest = true;
        break;
      case uProxy.ConsentUserAction.UNIGNORE_REQUEST:
        userState.ignoringRemoteUserRequest = false;
        break;
      case uProxy.ConsentUserAction.REQUEST:
        userState.localRequestsAccessFromRemote = true;
        userState.ignoringRemoteUserOffer = false;
        break;
      case uProxy.ConsentUserAction.CANCEL_REQUEST:
        userState.localRequestsAccessFromRemote = false;
        break;
      case uProxy.ConsentUserAction.IGNORE_OFFER:
        userState.ignoringRemoteUserOffer = true;
        break;
      case uProxy.ConsentUserAction.UNIGNORE_OFFER:
        userState.ignoringRemoteUserOffer = false;
        break;
      default:
        log.warn('Invalid uProxy.ConsentUserAction', action);
        return false;
    }
    return true;
  }
}
