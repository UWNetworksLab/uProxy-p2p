var tcpServer;

var activeConnections = [];

function handleClientAccept(client) {
	activeConnections.push(new Socks5Proxy(client));
};

function startup() {
	tcpServer = new TcpServer("127.0.0.1", 8123);
	tcpServer.listen(handleClientAccept);

	var un = document.createElement("input");
	un.placeholder = "username";
	document.body.appendChild(document.createElement("br"));
	document.body.appendChild(un);
	document.body.appendChild(document.createElement("br"));
	var pw = document.createElement("input");
	pw.type = "password";
	pw.placeholder = "password";
	document.body.appendChild(pw);
	var b = document.createElement("button");
	b.innerHTML="Connect";
	b.addEventListener('click', function() {
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
	}, true);
	document.body.appendChild(b);
}

window.addEventListener('load', startup, true);