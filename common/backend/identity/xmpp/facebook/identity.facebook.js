var NETWORK_ID = 'facebook';
var NETWORK_NAME = 'Facebook Identity Provider';

var CONNECT = function(agent, credentials, errorCallback) {
  var desiredJid = credentials.userId+'/'+agent;
  var connectOpts = {
    xmlns:'jabber:client',
    jid: desiredJid,
    access_token: credentials.token,
    api_key: '161927677344933',
    host: "chat.facebook.com"
  };
  console.log("Logging into XMPP with options: " + JSON.stringify(connectOpts));
  try {
    var client = new window.XMPP.Client(connectOpts);
    //DEBUG
    //client.preferredSaslMechanism = "PLAIN";
    //client.preferredSaslMechanism = "DIGEST-MD5";
    //client.preferredSaslMechanism = "SCRAM-SHA-1";
    //TODO(willscott): Support Upgrade to TLS wrapped connection.
    client.connection.allowTLS = false;
  } catch (e) {
    errorCallback(e);
    return null;
  }
  return client;
};
