var NETWORK_ID = 'google';
var NETWORK_NAME = 'Google Identity Provider';

var CONNECT = function(id, token) {
  var connectOpts = {
    xmlns:'jabber:client',
    jid: id,
    oauth2_token: token,
    oauth2_auth: 'http://www.google.com/talk/protocol/auth',
    host: "talk.google.com"
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
