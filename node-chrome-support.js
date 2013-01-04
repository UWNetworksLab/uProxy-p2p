/*
* This is the equivalent of node.js's cares wrapper,
* implementing the required socket / dns functions using chrome.socket.
*/

var chromeSupport = {
	//TODO(willscott): Add ipv6 support.
	isIP: function(ip) {
		var x = /\b(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/;
		return x.test(p);
	},
		
	getaddrinfo: function(domain, family) {
		
	},
	
	querySrv: function(name, onanswer) {
		
	}
}