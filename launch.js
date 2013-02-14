var tcpServer;

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

	var startXmpp = function() {
		var cl = new XMPP.Client({
			xmlns:'jabber:client',
			jid: creds.email,
			oauth2_token: creds.token,
			oauth2_auth: 'http://www.google.com/talk/protocol/auth',
			host: "talk.google.com"
		});

		//TODO(willscott): Support Upgrade to TLS wrapped connection.
		cl.connection.allowTLS = false;
		
		console.log(cl);
		cl.addListener('online', function() {
			console.log("online!");
			["willscott@gmail.com"].forEach(function(to) {
				cl.send(new XMPP.Element('message', {
					to: to,
					type: 'chat'}).c('body').t("Hello from browser"));
				});
			cl.end();
		});
		cl.addListener('error', function(e) {
		  console.error(e);
		});
	}

  var connect = document.createElement("button");
  connect.innerHTML = "Connect!";
  connect.addEventListener('click', startXmpp, true);
  document.body.appendChild(connect);
}

window.addEventListener('load', startup, true);