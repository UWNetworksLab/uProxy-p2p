var tcpServer;

var activeConnections = [];

function handleClientAccept(client) {
	activeConnections.push(new Socks5Proxy(client));
};

function startup() {
	tcpServer = new TcpServer("127.0.0.1", 8123);
	tcpServer.listen(handleClientAccept);
}

window.addEventListener('load', startup, true);