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
	}, true);
	document.body.appendChild(b);
}

window.addEventListener('load', startup, true);