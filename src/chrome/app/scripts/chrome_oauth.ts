/**
 * Chrome oauth provider
 **/

import uproxy_core_api = require('../../../interfaces/uproxy_core_api');
import ChromeUIConnector = require('./chrome_ui_connector');

class Chrome_oauth {
  constructor(private options_:{connector:ChromeUIConnector;}) {}

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
      interactive:boolean,
      continuation:(credentials:Object)=> void) {
    this.options_.connector.sendToUI(
        uproxy_core_api.Update.GET_CREDENTIALS,
        {url: authUrl, redirect: stateObj.redirect, interactive: interactive});
    this.options_.connector.setOnCredentials(continuation);
  }

}  // class Chrome_oauth

export = Chrome_oauth;
