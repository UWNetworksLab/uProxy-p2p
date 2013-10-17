var NETWORK_ID = 'facebook';
var NETWORK_NAME = 'Facebook Identity Provider';

var CONNECT = function(id, token) {
  var connectOpts = {
    xmlns:'jabber:client',
    jid: id,
    access_token: token,
    api_key: '161927677344933',
    host: "chat.facebook.com"
  };
  console.log("Logging into XMPP with options: " + JSON.stringify(connectOpts));
  var client = new window.XMPP.Client(connectOpts);
  //DEBUG
  //client.preferredSaslMechanism = "PLAIN";
  //client.preferredSaslMechanism = "DIGEST-MD5";
  //client.preferredSaslMechanism = "SCRAM-SHA-1";
  //TODO(willscott): Support Upgrade to TLS wrapped connection.
  client.connection.allowTLS = false;
  return client;
};
