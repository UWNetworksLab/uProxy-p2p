var NETWORK_ID = 'facebook';
var NETWORK_NAME = 'Facebook Identity Provider';
var CONNECT_OPTS = function(id, token) {
  return {
    xmlns:'jabber:client',
    jid: id,
    access_token: token,
    api_key: '161927677344933',
    host: "chat.facebook.com"
  };
};
