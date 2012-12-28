var tcpServer;

function handleClientData(data) {
	console.log(data);
}

function handleClientAccept(d) {
	d.addDataReceivedListener(handleClientData);
};

function startup() {
	tcpServer = new TcpServer("127.0.0.1", 8123);
	tcpServer.listen(handleClientAccept);
}


window.addEventListener('load', startup, true);