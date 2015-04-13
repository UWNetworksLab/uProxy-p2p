/**
 * Chrome oauth provider
 **/

import uproxy_types = require('../../../interfaces/uproxy');
import ChromeUIConnector = require('./chrome_ui_connector');

// TODO: review oauth freedom API design: having to depend on global vars is
// bad. There should be some way to specify constructor arguments. Also: better
// to use a promise style for async functions.
declare var connector :ChromeUIConnector;

class Chrome_oauth {
  // TODO: remove this when we no longer need a hack to get around bad oauth
  // API usage/design.
  private connector_:ChromeUIConnector = connector;

  public initiateOAuth(
      redirectURIs:{[urls:string]:string},
      continuation:(result:{redirect:string;state:string;}) => void) {
    // If we have uproxy.org pick that one,
    // otherwise pick the first http from the list.
    var redirect :string;
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

  public launchAuthFlow(
      authUrl:string,
      stateObj:{redirect:string},
      continuation:(credentials:Object)=> void) {
    this.connector_.sendToUI(
        uproxy_types.Update.GET_CREDENTIALS,
        {url :authUrl, redirect :stateObj.redirect});
    this.connector_.setOnCredentials(continuation);
  }

}  // class Chrome_oauth

export = Chrome_oauth;
