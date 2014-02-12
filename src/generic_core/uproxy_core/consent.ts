
// Consent if requested by the receiver and offered by the giver; when consent is requested and
// offered, then it is granted. Before either have happened, the status is NONE. IGNORE_XXX
// actions can happen by the side that has not taken any action. This puts the state into the
// IGNORED state. For a nice state diagram, see:
module Consent {
  // User-level consent actions.
  enum Action {
    REQUEST, CANCEL_REQUEST, ACCEPT_OFFER, IGNORE_OFFER
    OFFER, CANCEL_OFFER, ALLOW_REQUEST, IGNORE_REQUEST
  }
  // User level consent status for a remote instance to be our proxy client.
  enum ClientStatus {
    NONE, REQUESTED, IGNORED_REQUEST, OFFERED, GRANTED
  }
  // User-level consent status for a remote instance to be a proxy for us.
  enum ProxyStatus {
    NONE, REQUESTED, OFFERED, IGNORED_OFFER, GRANTED
  }

  localRequest(remoteAsProxyConsent : ProxyStatus) : ProxyStatus {
    switch(remoteAsProxyConsent){
      case Consent.Status.NONE:
        return Consent.Status.REQUESTED;
      case Consent.Status.IGNORED_OFFER:
      case Consent.Status.OFFERED:
        return Consent.Status.GRANTED;
      case Consent.Status.GRANTED:
      case Consent.Status.REQUESTED:
      default:
        throw Error("Local re-requested, shouldn't be possible.");
    }
  }

  localCancelRequest(remoteAsProxyConsent : ProxyStatus) : ProxyStatus {
    switch(remoteAsProxyConsent){
      case Consent.Status.GRANTED:
        return Consent.Status.OFFERED;
      case Consent.Status.REQUESTED:
        return Consent.Status.NONE;
      case Consent.Status.NONE:
      case Consent.Status.OFFERED:
      default:
        throw Error("Local cancelled request, but no request was made.");
    }
  }

  localCancelRequest(remoteAsProxyConsent : ProxyStatus) : ProxyStatus {
    switch(remoteAsProxyConsent){
      case Consent.Status.GRANTED:
        return Consent.Status.OFFERED;
      case Consent.Status.REQUESTED:
        return Consent.Status.NONE;
      case Consent.Status.NONE:
      case Consent.Status.OFFERED:
      default:
        throw Error("Local cancelled request, but no request was made.");
    }
  }

}  // Consent
