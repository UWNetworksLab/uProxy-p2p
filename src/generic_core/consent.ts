import * as logging from '../lib/logging/logging';
import * as social from '../interfaces/social';
import * as uproxy_core_api from '../interfaces/uproxy_core_api';

//module Consent {
  var log :logging.Log = new logging.Log('consent');

  export class State implements social.ConsentState {
    // Whether I am requesting access from my friend or not.  This should
    // remain true even after my friend grants me access (to indicate that
    // I've accepted their access-grant, and that I should automatically
    // request access from new instances)
    localRequestsAccessFromRemote :boolean;

    // Whether I am granting access to my friend from this local instance.
    // Granting permission to remote user gives access to every instance for
    // that user, but only to this local instance (the local user does not
    // sync consent between their own instances).
    localGrantsAccessToRemote :boolean;

    // Whether my friend is requesting access through me.
    remoteRequestsAccessFromLocal :boolean;

    // Used by the UI to ignore requests and offers.
    ignoringRemoteUserRequest :boolean;
    ignoringRemoteUserOffer :boolean;

    constructor(initialConsent :boolean) {
      this.localRequestsAccessFromRemote = initialConsent;
      this.ignoringRemoteUserOffer = false;
      this.localGrantsAccessToRemote = initialConsent;
      this.remoteRequestsAccessFromLocal = initialConsent;
      this.ignoringRemoteUserRequest = false;
    }
  }

  // Returns false on invalid actions.
  export function handleUserAction(
      state :State, action :uproxy_core_api.ConsentUserAction) :boolean {
    switch(action) {
      case uproxy_core_api.ConsentUserAction.OFFER:
        state.localGrantsAccessToRemote = true;
        state.ignoringRemoteUserRequest = false;
        break;
      case uproxy_core_api.ConsentUserAction.CANCEL_OFFER:
        state.localGrantsAccessToRemote = false;
        break;
      case uproxy_core_api.ConsentUserAction.IGNORE_REQUEST:
        state.ignoringRemoteUserRequest = true;
        break;
      case uproxy_core_api.ConsentUserAction.UNIGNORE_REQUEST:
        state.ignoringRemoteUserRequest = false;
        break;
      case uproxy_core_api.ConsentUserAction.REQUEST:
        state.localRequestsAccessFromRemote = true;
        state.ignoringRemoteUserOffer = false;
        break;
      case uproxy_core_api.ConsentUserAction.CANCEL_REQUEST:
        state.localRequestsAccessFromRemote = false;
        break;
      case uproxy_core_api.ConsentUserAction.IGNORE_OFFER:
        state.ignoringRemoteUserOffer = true;
        break;
      case uproxy_core_api.ConsentUserAction.UNIGNORE_OFFER:
        state.ignoringRemoteUserOffer = false;
        break;
      default:
        log.warn('Invalid ConsentUserAction', action);
        return false;
    }
    return true;
  }
//}
