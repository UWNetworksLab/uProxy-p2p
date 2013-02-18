var tcpServer;
var chatClient;
var activeJID = "";

var activeConnections = [];

function handleClientAccept(client) {
	var proxy = new Socks5Proxy(client);
  proxy._setXmppSender(function(jsondata) {
    chatClient.sendMessage(activeJID, jsondata);
  });
  activeConnections[proxy.xmppid] = proxy;
};

function startup() {
  // Local Proxy
  tcpServer = new TcpServer("127.0.0.1", 8123);
  tcpServer.listen(handleClientAccept);

  // Auth Flow.
  var creds = {};
  var start = document.createElement("button");
  start.innerHTML = "Log In!";
  start.addEventListener('click', function() {
    getCredentials(function(cred) {
      creds = cred;
      console.log(cred);
    });
  }, true);
  document.body.appendChild(start);

  var status = document.createElement("div");
  status.innerHTML = "No active friend connection.";
  var roster = document.createElement("div");
  var rosterPrinter = function(r) {
    roster.innerHTML = "";
    roster.appendChild(document.createTextNode("Available Friends:"));
    for (var i = 0; i < r.length; i++) {
      var child = document.createElement('div');
      child.innerHTML = r[i];
      child.addEventListener('click', function(jid) {
        activeJID = jid;
        console.log("Messages will be sent to: " + activeJID);
        status.innerText = "Active connection to " + activeJID;
      }.bind(this, r[i]), true);
      roster.appendChild(child);
    }
  }
  var streamListener = function(data) {
    console.log(data);
  }

  var connect = document.createElement("button");
  connect.innerHTML = "Connect!";
  connect.addEventListener('click', function() {
    chatClient = new XmppDaemon(creds);
    chatClient.setRosterListener(rosterPrinter);
    chatClient.setStreamListener(streamListener);
  }, true);
  document.body.appendChild(connect);
  document.body.appendChild(status);
  document.body.appendChild(roster);
}

window.addEventListener('load', startup, true);
