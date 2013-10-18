var NETWORK_ID = 'xmpp';
var NETWORK_NAME = 'Generic XMPP Identity Provider';

var CONNECT = function(id, token) {
  var host = getDomainFromJid(id);
  var baseJid = stripResource(id);
  var connectOpts = {
    xmlns:'jabber:client',
    host: host,
    //port: 5222,
    jid: baseJid,
    password: token
  };
  console.log("Logging into XMPP with options: " + JSON.stringify(connectOpts));
  var client = new window.XMPP.Client(connectOpts);
  //DEBUG
  client.preferredSaslMechanism = "PLAIN";
  //client.preferredSaslMechanism = "DIGEST-MD5";
  //client.preferredSaslMechanism = "SCRAM-SHA-1";
  //TODO(willscott): Support Upgrade to TLS wrapped connection.
  client.connection.allowTLS = false;
  return client;
};

function getDomainFromJid(jid) {
  var iAt = jid.indexOf('@');
  if (iAt == -1 || iAt >= (jid.length-1)) {
    console.error("Missing domain in XMPP username (e.g. alice@foo.com)");
    return null;
  }
  var host = stripResource(jid.substr(iAt+1));
  return host;
}

function stripResource(str) {
  var iSlash = str.indexOf('/');
  if (iSlash !== -1) {
    return str.substring(0, iSlash);
  }
  return str;
}

