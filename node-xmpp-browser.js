var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("dns",function(require,module,exports,__dirname,__filename,process,global){/**
 * Chrome Socket based Node DNS Implementation.
 *
 * Currently only handles the methods needed by node-xmpp.
 * @author Will Scott (willscott@gmail.com)
 */

var DNSTypes = {
  A: 1,
  NS: 2,
  MD: 3,
  MF: 4,
  CNAME: 5,
  SOA: 6,
  MB: 7,
  MG: 8,
  MR: 9,
  NULL: 10,
  WKS: 11,
  PTR: 12,
  HINFO: 13,
  MINFO: 14,
  MX: 15,
  TXT: 16,
  SRV: 33,
  AXFR: 252,
  MAILB: 253,
  MAILA: 254,
  ALL: 255
};

var _nid = 1;
function nextId() {
  return _nid++;
}

/**
 * Create a Network Packet from a DNS Query.
 * @param {id: short, query: domain name string, type: DNSTypes} dns
 * @return {ArrayBuffer}
 */
// TODO(willscott): Support multiple queries/message.
function flattenDNS(dns) {
  var length = 18 + dns.query.length;
  var buffer = new ArrayBuffer(length);
  var byteView = new Uint8Array(buffer);
  var dataView = new DataView(buffer);
	dataView.setUint16(0, nextId());
  byteView[2] = 1; // Recursion desired, other flags off.
  byteView[3] = 0; // Response Bits.
	dataView.setUint16(4, 1); // QDCount - # queries
	dataView.setUint16(6, 0); // ANCount - # answers
	dataView.setUint16(8, 0); // NSCount - # NS records
	dataView.setUint16(10, 0); // ARCount - # Additional resources.

  // QNAME
  var labels = dns.query.split(".");
  var offset = 12;
  for(var i = 0; i < labels.length; i++) {
    byteView[offset++] = labels[i].length;
    for (var j = 0; j < labels[i].length; j++) {
      byteView[offset++] = labels[i][j].charCodeAt(0);
    }
  }
  byteView[offset++] = 0; // Root Label

  // QTYPE
  byteView[offset++] = 0;
  byteView[offset++] = dns.type;
 
  // QCLASS - 1 = Internet 
  byteView[offset++] = 0;
  byteView[offset++] = 1;
 
  return buffer;
};

/**
 * Parse a textual label (A domain name) from a buffer.
 * @param {DataView} buffer
 * @param {Number} offset
 * @param {Boolean} nofollow OPTIONAL Don't follow label pointers.
 * @return {{text:String, length:Number}} the domain name & length of the inline label.
 */
function parseLabel(buffer, offset, nofollow) {
	var data = buffer.getUint8(offset);
	if (data == 0) {
		return {text: "", length: 1};
	} else if ((data & 192) == 192) { // Pointer.
		if (nofollow) {
			console.warn("Skipping Nested DNS label Pointer.");
			return {text: "", length: 2};
		} else {
			var offset = buffer.getUint16(offset) ^ (192 << 8)
		  return {text: parseLabel(buffer, offset, true).text, length: 2};
		}
	} else { // Length.
		offset++;
		var ret = "";
		for (var i = 0; i < data; i++) {
			ret += String.fromCharCode(buffer.getUint8(offset++))
		}
		var rest = parseLabel(buffer, offset, nofollow);
		if (rest.text.length) {
			return {text: ret + "." + rest.text, length: 1 + data + rest.length};
		} else {
			return {text: ret, length: 1 + data + rest.length};
		}
	}
}

/**
 * Parse an SRV Record
 * @param {ArrayBuffer} data
 * @return {{priority:, weight:, name:, port:}}
 */
function _parseSRV(data) {
	var srv = {};
	var buf = new DataView(data);
	srv.priority = buf.getUint16(0);
	srv.weight = buf.getUint16(2);
	srv.port = buf.getUint16(4);
	srv.name = parseLabel(buf, 6, true).text;
	return srv;
}

/**
 * Create a JS data structure from a DNS response packet.
 * @param {ArrayBuffer} dns
 * @return {Object} packet structure.
 */
function parseDNS(dns) {
	var dataView = new DataView(dns);
	var ret = {};
	ret.id = dataView.getUint16(0);
	if ((dataView.getUint8(2) & 128) != 128) { // is it a response
		console.warn("Asked to parse a DNS response that is not a response");
		return {};
	}
	ret.authoritative = (dataView.getUint8(2) & 4) == 4;
	ret.truncated = (dataView.getUint8(2) & 2) == 2;
	ret.recursed = (dataView.getUint8(2) & 1) == 1;
	ret.canRecurse = (dataView.getUint8(3) & 128) == 128;
	ret.code = dataView.getUint8(3) & 15;
	var nq = dataView.getUint16(4);
	var na = dataView.getUint16(6);
	var ns = dataView.getUint16(8);
	var ar = dataView.getUint16(10);
  var offset = 12;
	for (var i = 0; i < nq; i++) {
		// Parse Query
		var label = parseLabel(dataView, offset);
		offset += label.length;
		var type = dataView.getUint16(offset);
		offset += 2;
		var qclass = dataView.getUint16(offset);
		offset += 2;
		var q = {
			label: label.text,
			type: type,
			qclass: qclass
		};
		if (!ret.query) {
			ret.query = [q];
		} else {
			ret.query.push(q);
		}
	}

	for (var i = 0; i < na; i++) {
		// Parse Answer
		var label = parseLabel(dataView, offset);
		offset += label.length;
		var type = dataView.getUint16(offset);
		offset += 2;
		var rclass = dataView.getUint16(offset);
		offset += 2;
		var ttl = dataView.getUint32(offset);
		offset += 4;
		var rdl = dataView.getUint16(offset);
		offset += 2;
		var response = new Uint8Array(dns, offset, rdl);
		offset += rdl;
		var r = {
			label: label.text,
			type: type,
			rclass: rclass,
			ttl: ttl,
			response: response
		};
		if (!ret.response) {
			ret.response = [r];
		} else {
			ret.response.push(r);
		}
	}
	// TODO(willscott): handle NS, Additional data.
	return ret;
}

function queryDNS(server, msg, callback) {
  chrome.socket.create('udp', {}, function(_socketInfo) {
    chrome.socket.connect(_socketInfo.socketId, server, 53, function(result) {
			if (result != 0) {
				console.log("Could not connect to server!");
				callback(null);
				chrome.socket.destroy(_socketInfo.socketId);
			}
			var poll = function(n) {
				chrome.socket.read(n, function(r) {
					if (r.resultCode > 0) {
						callback(r);
						chrome.socket.disconnect(n);
						chrome.socket.destroy(n);
					} else {
						poll(n);
					}
				});
			};
			poll(_socketInfo.socketId);
			chrome.socket.write(_socketInfo.socketId, msg, function(sr) {
				if (sr.bytesWritten != msg.byteLength) {
					console.log("Write was unsucessful.");
					callback(null);
					chrome.socket.disconnect(_socketInfo.socketId);
					chrome.socket.destroy(_socketInfo.socketId);
				}
			});
    });
  });
};

//TODO(willscott): Add ipv6 support.
function isIP(ip) {
	var x = /\b(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/;
	return x.test(ip);
}

function getaddrinfo(domain, family) {
		if (family != 4 && family != 0) {
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
};
	
function querySrv(name, onanswer) {
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
};


var deferred = function() {
	this.oncomplete = function() {};
};

function makeAsync(callback) {
  if (typeof callback !== 'function') {
    return callback;
  }
  return function asyncCallback() {
    if (asyncCallback.immediately) {
      // The API already returned, we can invoke the callback immediately.
      callback.apply(null, arguments);
    } else {
      var args = arguments;
			setTimeout(function() {
        callback.apply(null, args);
      }, 0);
    }
  };
}

function errnoException(errorno, syscall) {
  // TODO make this more compatible with ErrnoException from src/node.cc
  // Once all of Node is using this function the ErrnoException from
  // src/node.cc should be removed.
  var e = new Error(syscall + ' ' + errorno);

  // For backwards compatibility. libuv returns ENOENT on NXDOMAIN.
  if (errorno == 'ENOENT') {
    errorno = 'ENOTFOUND';
  }

  e.errno = e.code = errorno;
  e.syscall = syscall;
  return e;
}

exports.lookup = function(domain, callback) {
	family = 0;
	callback = makeAsync(callback);
	if (!domain) {
	    callback(null, null, family === 6 ? 6 : 4);
	    return {};
	}
	var matchedFamily = chromeSupport.isIP(domain);
	if (matchedFamily) {
	  callback(null, domain, matchedFamily);
	  return {};
	}
	
	function onanswer(addresses) {
	    if (addresses) {
	      if (family) {
	        callback(null, addresses[0], family);
	      } else {
	        callback(null, addresses[0], addresses[0].indexOf(':') >= 0 ? 6 : 4);
	      }
	    } else {
	      callback(errnoException(errno, 'getaddrinfo'));
	    }
	  }
		
		var wrap = chromeSupport.getaddrinfo(domain, family);

		  if (!wrap) {
		    throw errnoException(errno, 'getaddrinfo');
		  }

		  wrap.oncomplete = onanswer;

		  callback.immediately = true;
		  return wrap;
};

exports.resolveSrv = function(name, callback) {
	function onanswer(status, result) {
	  if (!status) {
	   callback(null, result);
	  } else {
	    callback(errnoException(errno, bindingName));
	  }
	}

	callback = makeAsync(callback);
	var wrap = chromeSupport.querySrv(name, onanswer);
	if (!wrap) {
	  throw errnoException(errno, bindingName);
	}

	callback.immediately = true;
	return wrap;
};
});
