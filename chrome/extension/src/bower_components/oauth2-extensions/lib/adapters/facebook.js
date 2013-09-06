OAuth2.adapter('facebook', {
  authorizationCodeURL: function(config) {
    return ('https://www.facebook.com/dialog/oauth?' +
      'client_id={{CLIENT_ID}}&' +
      'redirect_uri={{REDIRECT_URI}}&' +
      'scope={{API_SCOPE}}')
        .replace('{{CLIENT_ID}}', config.clientId)
        .replace('{{REDIRECT_URI}}', this.redirectURL(config))
        .replace('{{API_SCOPE}}', config.apiScope);
  },

  redirectURL: function(config) {
    return 'http://www.facebook.com/robots.txt';
  },

  parseAuthorizationCode: function(url) {
    // TODO: error handling (URL may have
    // ?error=asfasfasiof&error_code=43 etc)
    return url.match(/[&\?]code=([^&]+)/)[1];
  },

  accessTokenURL: function() {
    return 'https://graph.facebook.com/oauth/access_token';
  },

  accessTokenMethod: function() {
    return 'GET';
  },

  accessTokenParams: function(authorizationCode, config) {
    return {
      code: authorizationCode,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: this.redirectURL(config)
    };
  },

  parseAccessToken: function(response) {
    return {
      accessToken: response.match(/access_token=([^&]*)/)[1],
      expiresIn: response.match(/expires=([^&]*)/)[1]
    };
  }
});
