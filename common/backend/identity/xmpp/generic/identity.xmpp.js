var NETWORK_ID = 'xmpp';
var NETWORK_NAME = 'Generic XMPP Identity Provider';
var CONNECT_OPTS = function(id, token) {
  var host = getDomainFromJid(id);
  var baseJid = stripResource(id);
  console.log("Logging in " + baseJid + " to host " + host);
  return {
    xmlns:'jabber:client',
    host: host,
    jid: baseJid,
    password: token
  };
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
