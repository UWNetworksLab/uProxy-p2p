/**
 * Hackety hack. Used by:
 *  - Google XMPP
 *  - Manual identity
 **/
/// <reference path='plumbing.ts'/>

declare var connector :ChromeUIConnector;

var Chrome_oauth = function() {
  console.log('constructor called');
};

Chrome_oauth.prototype.initiateOAuth = function(redirectURIs, continuation) {
  concinuation({
    redirect: 'https://www.uproxy.org/oauth-redirect-uri',
    state: ''
  });
  return true;
}

Chrome_oauth.prototype.launchAuthFlow = function(authUrl, stateObj, continuation) {
  /*
  if (this.socialNetworkName == 'Google' ||
      this.socialNetworkName == 'Facebook') {
    connector.sendToUI(uProxy.Update.GET_CREDENTIALS, this.socialNetworkName);
    connector.setOnCredentials((results) => {
      this.dispatchEvent('message', results);
    });
  } else {
    console.warn(
        'Authentication view provider asked to serve unknown social network: ' +
        this.socialNetworkName);
  }
  */
  continuation();
};
