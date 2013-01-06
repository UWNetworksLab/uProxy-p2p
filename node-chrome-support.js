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
		var msg = flattenDNS({query: domain, type: DNSTypes.A});
		queryDNS('8.8.8.8', msg, function(resp) {
			if (!resp || resp.resultCode < 0)
				return ret.oncomplete(null);
			var obj = parseDNS(resp.data);
			var addresses = [];
			for (var i = 0; i < obj.response.length; i++) {
				var answer = obj.response[i];
				if (answer.type == DNSTypes.A) {
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
		var ret = new deferred();
		ret.oncomplete = onanswer;
		var msg = flattenDNS({query: name, type: DNSTypes.SRV});
		queryDNS('8.8.8.8', msg, function(resp) {
			if (!resp || resp.resultCode < 0)
				return ret.oncomplete(-1, null);
			var obj = parseDNS(resp.data);
			var records = [];
			if (obj.response) {
			  for (var i = 0; i < obj.response.length; i++) {
				  var answer = obj.response[i];
				  if (answer.type == DNSTypes.SRV) {
					  records.push(_parseSRV(answer.response.buffer));
				  }
			  }
			}
			onanswer(0, records);
		});
		return ret;
	}
}


var deferred = function() {
	this.oncomplete = function() {};
};