var NETWORK_ID = 'xmpp';
var NETWORK_NAME = 'Generic XMPP Identity Provider';
var CONNECT_OPTS = function(id, token) {
  return {
    xmlns:'jabber:client',
    host: getDomainFromJid(jid),
    jid: id,
    password: token
  };
};

function getDomainFromJid(jid) {
  var i = jid.indexOf('@');
  if (i == -1 || i >= (jid.length-1)) {
    console.error("Missing domain in XMPP username (e.g. alice@foo.com)");
    return null;
  }
  var host = jid.substr(i+1);
  console.log("Logging in " + jid + " to host " + host);
  return host;
}
