/**
 * Hackety hack. Used by:
 *  - Google XMPP
 *  - Manual identity
 **/
/// <reference path='plumbing.ts'/>

var connector :ChromeUIConnector;

var Chrome_oauth = function() {
};

Chrome_oauth.prototype.initiateOAuth = function(redirectURIs, continuation) {
  continuation({
    redirect: 'https://www.uproxy.org/oauth-redirect-uri',
    state: ''
  });
  return true;
}

Chrome_oauth.prototype.launchAuthFlow = function(authUrl, stateObj, continuation) {
  connector.sendToUI(uProxy.Update.GET_CREDENTIALS, authUrl);
  connector.setOnCredentials((result) => {
    continuation(result);
  });
};
