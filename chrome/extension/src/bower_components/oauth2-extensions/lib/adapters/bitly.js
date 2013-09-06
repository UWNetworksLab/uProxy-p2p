OAuth2.adapter('bitly', {

  authorizationCodeURL: function(config) {
    return ('https://bitly.com/oauth/authorize?' +
      'client_id={{CLIENT_ID}}&' +
      'redirect_uri={{REDIRECT_URI}}')
        .replace('{{CLIENT_ID}}', config.clientId)
        .replace('{{REDIRECT_URI}}', this.redirectURL(config));
  },

  redirectURL: function(config) {
    return 'http://bitly.com/robots.txt';
  },

  parseAuthorizationCode: function(url) {
    // TODO: Error handling (URL may have ?error=foo_bar&error_code=43 etc).
    return url.match(/[&\?]code=([^&]+)/)[1];
  },

  accessTokenURL: function() {
    return 'https://api-ssl.bitly.com/oauth/access_token';
  },

  accessTokenMethod: function() {
    return 'POST';
  },

  accessTokenParams: function(authorizationCode, config) {
    return {
      code: authorizationCode,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: this.redirectURL(config),
      grant_type: 'authorization_code'
    };
  },

  parseAccessToken: function(response) {
    return {
      accessToken: response.match(/access_token=([^&]*)/)[1],
      apiKey: response.match(/apiKey=([^&]*)/)[1],
      expiresIn: Number.MAX_VALUE,
      login: response.match(/login=([^&]*)/)[1]
    };
  }

});