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
  var start = document.createElement("button");
  start.innerHTML = "Log In!";
  start.addEventListener('click', function() {
    getCredentials(function(cred) {
      console.log(cred);
    });
  }, true);
  document.body.appendChild(start);

	var startXmpp = function() {
		var cl = new XMPP.Client({
			xmlns:'jabber:client',
			jid: un.value,
		  password: pw.value,
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
}

window.addEventListener('load', startup, true);