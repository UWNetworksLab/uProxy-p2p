var tcpServer;

function handleClientEvent(d) {
	chrome.socket.read(d.socketId, null, function(data) {
		console.log(data);		
	});
};

function startup() {
	tcpServer = new TcpServer("127.0.0.1", 8123);
	tcpServer.listen(handleClientEvent);
}


window.addEventListener('load', startup, true);