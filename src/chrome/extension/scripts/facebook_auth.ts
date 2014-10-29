
/// <reference path='../../../uproxy.ts' />
/// <reference path='chrome_tab_auth.ts' />

class FacebookAuth extends ChromeTabAuth {
  constructor() {
    super();
  }

  public getOauthUrl = (redirctUrl) : string => {
    // uProxy app id.
    var FACEBOOK_APP_ID = '161927677344933';

    var FACEBOOK_TOKENINFO_URL = 'https://graph.facebook.com/me?access_token=';

    // publish_actions needed for posting to wall
    // user_friends needed to get roster (currently only returns uProxy users).
    // manage_notifications needed to read any notifications
    // read_stream needed to read object.message within notification
    var FACEBOOK_OAUTH_SCOPES =
        'publish_actions,user_friends,manage_notifications,read_stream';

    return 'https://www.facebook.com/dialog/oauth?' +
        'client_id=' + encodeURIComponent(FACEBOOK_APP_ID) +
        '&redirect_uri=' + encodeURIComponent(redirctUrl) +
        '&scope=' + encodeURIComponent(FACEBOOK_OAUTH_SCOPES) +
        '&response_type=token';
  }
  
  public extractCode = (url) : Promise<any> => {
    if (url.indexOf('error=access_denied') > 0) {
      return Promise.reject('User denied access.');
    }

    var query = {};
    if (url && url.indexOf('#') >= 0) {
      var queryTok = url.substr(url.indexOf('#') + 1).split('&');
      for (var i = 0; i < queryTok.length; i++) {
        var tmp = queryTok[i].split('=');
        if (tmp.length > 1) {
          query[tmp[0]] = tmp[1];
        }
      }
    }
    var accessToken = query['access_token'];
    if (accessToken) {
      return Promise.resolve({accessToken: accessToken});
    } else {
      return Promise.reject('Access token not found');
    }
  }
}
