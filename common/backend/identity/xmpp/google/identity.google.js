var NETWORK_ID = 'google';
var NETWORK_NAME = 'Google Identity Provider';
var CONNECT_OPTS = function(id, token) {
  return {
    xmlns:'jabber:client',
    jid: id,
    oauth2_token: token,
    oauth2_auth: 'http://www.google.com/talk/protocol/auth',
    host: "talk.google.com"
  };
};
