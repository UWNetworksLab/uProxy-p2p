OAuth2.adapter('sample', {
  /**
   * @return {URL} URL to the page that returns the authorization code
   */
  authorizationCodeURL: function(config) {
    return '';
  },

  /**
   * @return {URL} URL to the page that we use to inject the content
   * script into
   */
  redirectURL: function(config) {
    return '';
  },

  /**
   * @return {String} Authorization code for fetching the access token
   */
  parseAuthorizationCode: function(url) {
    return '';
  },

  /**
   * @return {URL} URL to the access token providing endpoint
   */
  accessTokenURL: function() {
    return '';
  },

  /**
   * @return {String} HTTP method to use to get access tokens
   */
  accessTokenMethod: function() {
    return 'POST';
  },

  /**
   * @return {Object} The payload to use when getting the access token
   */
  accessTokenParams: function(authorizationCode, config) {
    return {};
  },

  /**
   * @return {Object} Object containing accessToken {String},
   * refreshToken {String} and expiresIn {Int}
   */
  parseAccessToken: function(response) {
    return {
      accessToken: '',
      refreshToken: '',
      expiresIn: Number.MAX_VALUE
    };
  }
});
