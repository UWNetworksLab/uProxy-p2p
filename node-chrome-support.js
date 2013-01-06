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
		if (family != 4 || family != 0) {
			console.warn("IPV6 Not supported!");
		}
		var ret = new deferred();
		var msg = flattenDNS({query: domain, id: 1, type: 1});
		queryDNS('8.8.8.8', msg, function(resp) {
			if (!resp || resp.resultCode < 0)
				return ret.oncomplete(null);
			var obj = parseDNS(resp.data);
			var addresses = [];
			for (var i = 0; i < obj.response.length; i++) {
				var answer = obj.response[i];
				if (answer.type == 1) {
					var quad = answer.response;
					var addr = quad[0] + "." + quad[1] + "." + quad[2] + "." + quad[3];
					addresses.push(addr);
				}
			}
			return ret.oncomplete(addresses);
		});
		return ret;
	},
	
	querySrv: function(name, onanswer) {
		
	}
}


var deferred = function() {
	this.oncomplete = function() {};
};