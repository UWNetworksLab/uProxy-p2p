var tcpServer;
var chatClient;

var activeConnections = [];

function handleClientAccept(client) {
	activeConnections.push(new Socks5Proxy(client));
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

  var roster = document.createElement("pre");
  var rosterPrinter = function(r) {
    var s = "";
    for (var i = 0; i < r.length; i++) {
      s += r[i] + "\n";
    }
    roster.innerHTML = s;
  }
  var connect = document.createElement("button");
  connect.innerHTML = "Connect!";
  connect.addEventListener('click', function() {
    chatClient = new XmppDaemon(creds);
    chatClient.setRosterListener(rosterPrinter)
  }, true);
  document.body.appendChild(connect);
  document.body.appendChild(roster);
}

window.addEventListener('load', startup, true);