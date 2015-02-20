/**
 * Chrome oauth provider
 **/
/// <reference path='background.ts'/>

var connector :ChromeUIConnector;

var Chrome_oauth = function() {
};

Chrome_oauth.prototype.initiateOAuth = function(redirectURIs, continuation) {
  // If we have uproxy.org pick that one,
  // otherwise pick the first http from the list.
  var redirect;
  for (var i in redirectURIs) {
    if (redirectURIs[i] === 'https://www.uproxy.org/oauth-redirect-uri') {
      redirect = redirectURIs[i];
      break;
    }

    if (redirect !== '' && (redirectURIs[i].indexOf('https://') === 0 ||
        redirectURIs[i].indexOf('http://') === 0)) {
      redirect = redirectURIs[i];
    }
  }

  if (redirect) {
    continuation({
      redirect: redirect,
      state: ''
    });
    return true
  }
  return false;
}

Chrome_oauth.prototype.launchAuthFlow = function(authUrl, stateObj, continuation) {
  connector.sendToUI(uProxy.Update.GET_CREDENTIALS,
                    {url :authUrl, redirect :stateObj.redirect});
  connector.setOnCredentials((result) => {
    continuation(result);
  });
};
