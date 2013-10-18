var NETWORK_ID = 'xmpp';
var NETWORK_NAME = 'Generic XMPP Identity Provider';
var DEFAULT_XMPP_PORT = 5222;

var CONNECT = function(agent, credentials, errorCallback) {
  var host, port;
  if (credentials.host) {
    host = credentials.host;
  } else {
    host = getDomainFromJid(credentials.userId);
  }
  if (credentials.port) {
    port = credentials.port;
  } else {
    port = DEFAULT_XMPP_PORT;
  }
  var baseJid = stripResource(credentials.userId);
  var connectOpts = {
    xmlns:'jabber:client',
    host: host,
    port: port,
    jid: baseJid,
    password: credentials.token
  };
  console.log("Logging into XMPP with options: " + JSON.stringify(connectOpts));
  try {
    var client = new window.XMPP.Client(connectOpts);
    //DEBUG
    client.preferredSaslMechanism = "PLAIN";
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

