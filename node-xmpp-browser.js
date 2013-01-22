(function(){var require = function (file, cwd) {
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
	var matchedFamily = isIP(domain);
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
		
		var wrap = getaddrinfo(domain, family);

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
	var wrap = querySrv(name, onanswer);
	if (!wrap) {
	  throw errnoException(errno, bindingName);
	}

	callback.immediately = true;
	return wrap;
};
});

require.define("_stream_readable",function(require,module,exports,__dirname,__filename,process,global){// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.
module.exports = Readable;
Readable.ReadableState = ReadableState;

var Stream = require('stream');
var util = require('util');
var StringDecoder;

util.inherits(Readable, Stream);

function ReadableState(options, stream) {
  options = options || {};

  // the argument passed to this._read(n,cb)
  this.bufferSize = options.bufferSize || 16 * 1024;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

  // the minimum number of bytes to buffer before emitting 'readable'
  // default to pushing everything out as fast as possible.
  this.lowWaterMark = options.lowWaterMark || 0;

  // cast to ints.
  this.bufferSize = ~~this.bufferSize;
  this.lowWaterMark = ~~this.lowWaterMark;
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = false;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;
  this.sync = false;
  this.onread = function(er, data) {
    onread(stream, er, data);
  };

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;
  this.pipeChunkSize = null;

  this.decoder = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
  }
}

function Readable(options) {
  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk) {
  var rs = this._readableState;
  rs.onread(null, chunk);

  // if it's past the high water mark, we can push in some more.
  // Also, if it's still within the lowWaterMark, we can stand some
  // more bytes.  This is to work around cases where hwm=0 and
  // lwm=0, such as the repl.
  return rs.length < rs.highWaterMark || rs.length <= rs.lowWaterMark;
};

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
};


function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (isNaN(n) || n === null)
    return state.length;

  if (n <= 0)
    return 0;

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else
      return state.length;
  }

  return n;
}

// you can override either this method, or _read(n, cb) below.
Readable.prototype.read = function(n) {
  var state = this._readableState;
  var nOrig = n;

  if (typeof n !== 'number' || n > 0)
    state.emittedReadable = false;

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;

  // if we currently have less than the highWaterMark, then also read some
  if (state.length - n <= state.highWaterMark)
    doRead = true;

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading)
    doRead = false;

  if (doRead) {
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.bufferSize, state.onread);
    state.sync = false;
  }

  // If _read called its callback synchronously, then `reading`
  // will be false, and we need to re-evaluate how much data we
  // can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  var ret;
  if (n > 0)
    ret = fromList(n, state.buffer, state.length, !!state.decoder);
  else
    ret = null;

  if (ret === null || ret.length === 0) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  return ret;
};

function onread(stream, er, chunk) {
  var state = stream._readableState;
  var sync = state.sync;

  state.reading = false;
  if (er)
    return stream.emit('error', er);

  if (!chunk || !chunk.length) {
    // eof
    state.ended = true;
    if (state.decoder) {
      chunk = state.decoder.end();
      if (chunk && chunk.length) {
        state.buffer.push(chunk);
        state.length += chunk.length;
      }
    }
    // if we've ended and we have some data left, then emit
    // 'readable' now to make sure it gets picked up.
    if (!sync) {
      if (state.length > 0) {
        state.needReadable = false;
        if (!state.emittedReadable) {
          state.emittedReadable = true;
          stream.emit('readable');
        }
      } else
        endReadable(stream);
    }
    return;
  }

  if (state.decoder)
    chunk = state.decoder.write(chunk);

  // update the buffer info.
  if (chunk) {
    state.length += chunk.length;
    state.buffer.push(chunk);
  }

  // if we haven't gotten enough to pass the lowWaterMark,
  // and we haven't ended, then don't bother telling the user
  // that it's time to read more data.  Otherwise, emitting 'readable'
  // probably will trigger another stream.read(), which can trigger
  // another _read(n,cb) before this one returns!
  if (state.length <= state.lowWaterMark) {
    state.reading = true;
    stream._read(state.bufferSize, state.onread);
    return;
  }

  if (state.needReadable && !sync) {
    state.needReadable = false;
    if (!state.emittedReadable) {
      state.emittedReadable = true;
      stream.emit('readable');
    }
  }
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n, cb) {
  process.nextTick(function() {
    cb(new Error('not implemented'));
  });
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;

  if ((!pipeOpts || pipeOpts.end !== false) &&
      dest !== process.stdout &&
      dest !== process.stderr) {
    src.once('end', onend);
  } else {
    src.once('end', cleanup);
  }

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    if (readable !== src) return;
    cleanup();
  }

  if (pipeOpts && pipeOpts.chunkSize)
    state.pipeChunkSize = pipeOpts.chunkSize;

  function onend() {
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  function cleanup() {
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', unpipe);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (!dest._writableState || dest._writableState.needDrain)
      ondrain();
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    unpipe();
    if (dest.listeners('error').length === 0)
      dest.emit('error', er);
  }
  dest.once('error', onerror);

  // if the dest emits close, then presumably there's no point writing
  // to it any more.
  dest.once('close', unpipe);
  function onfinish() {
    dest.removeListener('close', unpipe);
  }
  dest.once('finish', onfinish);

  function unpipe() {
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    // the handler that waits for readable events after all
    // the data gets sucked out in flow.
    // This would be easier to follow with a .once() handler
    // in flow(), but that is too slow.
    this.on('readable', pipeOnReadable);

    state.flowing = true;
    process.nextTick(function() {
      flow(src);
    });
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var dest = this;
    var state = src._readableState;
    state.awaitDrain--;
    if (state.awaitDrain === 0)
      flow(src);
  };
}

function flow(src) {
  var state = src._readableState;
  var chunk;
  state.awaitDrain = 0;

  function write(dest, i, list) {
    var written = dest.write(chunk);
    if (false === written) {
      state.awaitDrain++;
    }
  }

  while (state.pipesCount &&
         null !== (chunk = src.read(state.pipeChunkSize))) {

    if (state.pipesCount === 1)
      write(state.pipes, 0, null);
    else
      state.pipes.forEach(write);

    src.emit('data', chunk);

    // if anyone needs a drain, then we have to wait for that.
    if (state.awaitDrain > 0)
      return;
  }

  // if every destination was unpiped, either before entering this
  // function, or in the while loop, then stop flowing.
  //
  // NB: This is a pretty rare edge case.
  if (state.pipesCount === 0) {
    state.flowing = false;

    // if there were data event listeners added, then switch to old mode.
    if (src.listeners('data').length)
      emitDataEvents(src);
    return;
  }

  // at this point, no one needed a drain, so we just ran out of data
  // on the next readable event, start it over again.
  state.ranOut = true;
}

function pipeOnReadable() {
  if (this._readableState.ranOut) {
    this._readableState.ranOut = false;
    flow(this);
  }
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    this.removeListener('readable', pipeOnReadable);
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    this.removeListener('readable', pipeOnReadable);

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = state.pipes.indexOf(dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// kludge for on('data', fn) consumers.  Sad.
// This is *not* part of the new readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  // https://github.com/isaacs/readable-stream/issues/16
  // if we're already flowing, then no need to set up data events.
  if (ev === 'data' && !this._readableState.flowing)
    emitDataEvents(this);

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  emitDataEvents(this);
  this.read(0);
  this.emit('resume');
};

Readable.prototype.pause = function() {
  emitDataEvents(this, true);
  this.emit('pause');
};

function emitDataEvents(stream, startPaused) {
  var state = stream._readableState;

  if (state.flowing) {
    // https://github.com/isaacs/readable-stream/issues/16
    throw new Error('Cannot switch to old mode now.');
  }

  var paused = startPaused || false;
  var readable = false;

  // convert to an old-style stream.
  stream.readable = true;
  stream.pipe = Stream.prototype.pipe;
  stream.on = stream.addListener = Stream.prototype.on;

  stream.on('readable', function() {
    readable = true;

    var c;
    while (!paused && (null !== (c = stream.read())))
      stream.emit('data', c);

    if (c === null) {
      readable = false;
      stream._readableState.needReadable = true;
    }
  });

  stream.pause = function() {
    paused = true;
    this.emit('pause');
  };

  stream.resume = function() {
    paused = false;
    if (readable)
      process.nextTick(function() {
        stream.emit('readable');
      });
    else
      this.read(0);
    this.emit('resume');
  };

  // now make it start, just in case it hadn't already.
  stream.emit('readable');
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    state.ended = true;
    if (state.decoder) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    if (state.decoder)
      chunk = state.decoder.write(chunk);
    if (!chunk || !chunk.length)
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (typeof stream[i] === 'function' &&
        typeof this[i] === 'undefined') {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }}(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  events.forEach(function(ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n, cb) {
    if (paused) {
      stream.resume();
      paused = false;
    }
  };
};



// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, list, length, stringMode) {
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0) {
    return null;
  }

  if (length === 0)
    ret = null;
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;
  if (state.endEmitted)
    return;
  state.ended = true;
  state.endEmitted = true;
  process.nextTick(function() {
    stream.readable = false;
    stream.emit('end');
  });
}

});

require.define("_stream_writable",function(require,module,exports,__dirname,__filename,process,global){// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, cb), and it'll handle all
// the drain event emission and buffering.

module.exports = Writable;
Writable.WritableState = WritableState;

var util = require('util');
var assert = require('assert');
var Stream = require('stream');

util.inherits(Writable, Stream);

function WritableState(options, stream) {
  options = options || {};

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

  // the point that it has to get to before we call _write(chunk,cb)
  // default to pushing everything out as fast as possible.
  this.lowWaterMark = options.lowWaterMark || 0;

  // cast to ints.
  this.lowWaterMark = ~~this.lowWaterMark;
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' has emitted
  this.finished = false;
  // when 'finish' is being emitted
  this.finishing = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.
  this.sync = false;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.buffer = [];
}

function Writable(options) {
  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Stream.Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  Stream.call(this);
}

// Override this method or _write(chunk, cb)
Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (state.ended) {
    var er = new Error('write after end');
    if (typeof cb === 'function')
      cb(er);
    this.emit('error', er);
    return;
  }

  var l = chunk.length;
  if (false === state.decodeStrings)
    chunk = [chunk, encoding || 'utf8'];
  else if (typeof chunk === 'string' || encoding) {
    chunk = new Buffer(chunk + '', encoding);
    l = chunk.length;
  }

  state.length += l;

  var ret = state.length < state.highWaterMark;
  if (ret === false)
    state.needDrain = true;

  // if we're already writing something, then just put this
  // in the queue, and wait our turn.
  if (state.writing) {
    state.buffer.push([chunk, cb]);
    return ret;
  }

  state.writing = true;
  state.sync = true;
  state.writelen = l;
  state.writecb = cb;
  this._write(chunk, state.onwrite);
  state.sync = false;

  return ret;
};

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;
  var l = state.writelen;

  state.writing = false;
  state.writelen = null;
  state.writecb = null;

  if (er) {
    if (cb) {
      // If _write(chunk,cb) calls cb() in this tick, we still defer
      // the *user's* write callback to the next tick.
      // Never present an external API that is *sometimes* async!
      if (sync)
        process.nextTick(function() {
          cb(er);
        });
      else
        cb(er);
    }

    // backwards compatibility.  still emit if there was a cb.
    stream.emit('error', er);
    return;
  }
  state.length -= l;

  if (cb) {
    // Don't call the cb until the next tick if we're in sync mode.
    if (sync)
      process.nextTick(cb);
    else
      cb();
  }

  if (state.length === 0 && (state.ended || state.ending) &&
      !state.finished && !state.finishing) {
    // emit 'finish' at the very end.
    state.finishing = true;
    stream.emit('finish');
    state.finished = true;
    return;
  }

  if (state.length <= state.lowWaterMark && state.needDrain) {
    // Must force callback to be called on nextTick, so that we don't
    // emit 'drain' before the write() consumer gets the 'false' return
    // value, and has a chance to attach a 'drain' listener.
    process.nextTick(function() {
      if (!state.needDrain)
        return;
      state.needDrain = false;
      stream.emit('drain');
    });
  }

  // if there's something in the buffer waiting, then process it
  // It would be nice if there were TCO in JS, and we could just
  // shift the top off the buffer and _write that, but that approach
  // causes RangeErrors when you have a very large number of very
  // small writes, and is not very efficient otherwise.
  if (!state.bufferProcessing && state.buffer.length) {
    state.bufferProcessing = true;

    for (var c = 0; c < state.buffer.length; c++) {
      var chunkCb = state.buffer[c];
      var chunk = chunkCb[0];
      cb = chunkCb[1];

      if (false === state.decodeStrings)
        l = chunk[0].length;
      else
        l = chunk.length;

      state.writelen = l;
      state.writecb = cb;
      state.writechunk = chunk;
      state.writing = true;
      state.sync = true;
      stream._write(chunk, state.onwrite);
      state.sync = false;

      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        c++;
        break;
      }
    }

    state.bufferProcessing = false;
    if (c < state.buffer.length)
      state.buffer = state.buffer.slice(c);
    else
      state.buffer.length = 0;
  }
}

Writable.prototype._write = function(chunk, cb) {
  process.nextTick(function() {
    cb(new Error('not implemented'));
  });
};

Writable.prototype.end = function(chunk, encoding) {
  var state = this._writableState;

  // ignore unnecessary end() calls.
  if (state.ending || state.ended || state.finished)
    return;

  state.ending = true;
  if (chunk)
    this.write(chunk, encoding);
  else if (state.length === 0 && !state.finishing && !state.finished) {
    state.finishing = true;
    this.emit('finish');
    state.finished = true;
  }
  state.ended = true;
};

});

require.define("_stream_duplex",function(require,module,exports,__dirname,__filename,process,global){// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.
module.exports = Duplex;
var util = require('util');
var Readable = require('_stream_readable');
var Writable = require('_stream_writable');

util.inherits(Duplex, Readable);

Object.keys(Writable.prototype).forEach(function(method) {
  if (!Duplex.prototype[method])
    Duplex.prototype[method] = Writable.prototype[method];
});

function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false)
    this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended)
    return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  process.nextTick(this.end.bind(this));
}

});

require.define("/lib/xmpp/connection.js",function(require,module,exports,__dirname,__filename,process,global){var net = require('net');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var ltx = require('ltx');
var StreamParser = require('./stream_parser');
var starttls = require('../starttls');

var NS_XMPP_TLS = exports.NS_XMPP_TLS = 'urn:ietf:params:xml:ns:xmpp-tls';
var NS_STREAM = exports.NS_STREAM = 'http://etherx.jabber.org/streams';
var NS_XMPP_STREAMS = 'urn:ietf:params:xml:ns:xmpp-streams';

/**
 Base class for connection-based streams (TCP).

 The socket parameter is optional for incoming connections.
*/

var MAX_RECONNECT_DELAY = 30 * 1000;


function Connection(opts) {
    EventEmitter.call(this);

    this.streamAttrs = opts.streamAttrs || {};
    this.xmlns = opts.xmlns || {};
    this.xmlns.stream = NS_STREAM;

    this.socket = opts.socket || new net.Socket();
    this.reconnectDelay = 0;

    this.setupStream();
    if (this.socket.readable)
	this.startParser();
    else {
	var that = this;
	this.socket.on('connect', function() {
	    that.startParser();
	    that.emit('connect');
	});
    }

    this.mixins = [];
}

util.inherits(Connection, EventEmitter);
exports.Connection = Connection;

// Defaults
Connection.prototype.allowTLS = true;

/**
 Used by both the constructor and by reinitialization in setSecure().
*/
Connection.prototype.setupStream = function() {
    var self = this;

    this.socket.addListener('data', function(data) {
        self.onData(data);
    });
    this.socket.addListener('end', function() {
        self.onEnd();
    });
    this.socket.addListener('error', function() {
	/* unhandled errors may throw up in node, preventing a reconnect */
        self.onEnd();
    });
    this.socket.addListener('close', function() {
	self.onClose();
    });
    var proxyEvent = function(event) {
        self.socket.addListener(event, function() {
	    var args = Array.prototype.slice.call(arguments);
	    args.unshift(event);
	    self.emit.apply(self, args);
        });
    };
    proxyEvent('data');  // let them sniff unparsed XML
    proxyEvent('drain');
    //proxyEvent('close');

    /**
     * This is optimized for continuous TCP streams. If your "socket"
     * actually transports frames (WebSockets) and you can't have
     * stanzas split across those, use:
     *     cb(el.toString());
     */
    if (!this.socket.serializeStanza) {
        this.socket.serializeStanza = function(el, cb) {
            // Continuously write out
            el.write(function(s) {
                cb(s);
            });
        };
    }
};


Connection.prototype.pause = function() {
    if (this.socket.pause)
	this.socket.pause();
};

Connection.prototype.resume = function() {
    if (this.socket.resume)
	this.socket.resume();
};

/** Climbs the stanza up if a child was passed,
    but you can send strings and buffers too.

    Returns whether the socket flushed data.
*/
Connection.prototype.send = function(stanza) {
    var self = this;
    var flushed = true;
    if (!this.socket) {
        return; // Doh!
    }
    if (!this.socket.writable) {
        this.socket.end();
        return;
    }

    if (stanza.root) {
        var el = this.rmXmlns(stanza.root());
        this.socket.serializeStanza(el, function(s) {
            flushed = self.socket.write(s);
        });
    } else {
        flushed = this.socket.write(stanza);
    }
    return flushed;
};

Connection.prototype.startParser = function() {
    var self = this;
    this.parser = new StreamParser.StreamParser(this.maxStanzaSize);

    this.parser.addListener('streamStart', function(attrs) {
        /* We need those xmlns often, store them extra */
        self.streamNsAttrs = {};
        for(var k in attrs) {
        if (k == 'xmlns' ||
            k.substr(0, 6) == 'xmlns:')
                self.streamNsAttrs[k] = attrs[k];
        }

        /* Notify in case we don't wait for <stream:features/>
           (Component or non-1.0 streams)
         */
        self.emit('streamStart', attrs);
    });
    this.parser.addListener('stanza', function(stanza) {
        self.onStanza(self.addStreamNs(stanza));
    });
    this.parser.addListener('error', function(e) {
        self.error(e.condition || 'internal-server-error', e.message);
    });
    this.parser.addListener('end', function() {
        self.stopParser();
        self.end();
    });
};

Connection.prototype.stopParser = function() {
    /* No more events, please (may happen however) */
    if(this.parser) {
        /* Get GC'ed */
        delete this.parser;
    }
};

Connection.prototype.startStream = function() {
    /* reset reconnect delay */
    this.reconnectDelay = 0;
    
    var attrs = {};
    for(var k in this.xmlns) {
        if (this.xmlns.hasOwnProperty(k)) {
            if (!k)
                attrs.xmlns = this.xmlns[k];
            else
                attrs['xmlns:' + k] = this.xmlns[k];
        }
    }
    for(k in this.streamAttrs) {
	if (this.streamAttrs.hasOwnProperty(k))
	    attrs[k] = this.streamAttrs[k];
    }

    var el = new ltx.Element('stream:stream', attrs);
    // make it non-empty to cut the closing tag
    el.t(' ');
    var s = el.toString();
    this.send(s.substr(0, s.indexOf(' </stream:stream>')));

    this.streamOpened = true;
};

Connection.prototype.onData = function(data) {
    if (this.parser)
        this.parser.write(data);
};

Connection.prototype.setSecure = function(credentials, isServer) {
    var self = this;

    // Remove old event listeners
    this.socket.removeAllListeners('data');
    // retain socket 'end' listeners because ssl layer doesn't support it
    this.socket.removeAllListeners('drain');
    this.socket.removeAllListeners('close');
    // remove idle_timeout
    if (this.socket.clearTimer)
	this.socket.clearTimer();

    this.stopParser();
    var ct = starttls(this.socket, credentials || this.credentials, isServer, function() {
	self.isSecure = true;
	self.startParser();
	if (!isServer)
	    // Clients start <stream:stream>, servers reply
	    self.startStream();
    });
    ct.on('close', function() {
	self.onClose();
    });

    // The socket is now the cleartext stream
    this.socket = ct;

    // Attach new listeners on the cleartext stream
    this.setupStream();
};

/**
 * This is not an event listener, but takes care of the TLS handshake
 * before 'stanza' events are emitted to the derived classes.
 */
Connection.prototype.onStanza = function(stanza) {
    if (stanza.is('error', NS_STREAM)) {
        /* TODO: extract error text */
        this.emit('error', stanza);
    } else if (stanza.is('features', NS_STREAM) &&
               this.allowTLS &&
	       !this.isSecure &&
               stanza.getChild('starttls', NS_XMPP_TLS)) {
        /* Signal willingness to perform TLS handshake */
        this.send(new ltx.Element('starttls', { xmlns: NS_XMPP_TLS }));
    } else if (this.allowTLS &&
               stanza.is('proceed', NS_XMPP_TLS)) {
        /* Server is waiting for TLS handshake */
        this.setSecure();
    } else {
        this.emit('stanza', stanza);
    }
};

/**
 * Add stream xmlns to a stanza
 *
 * Does not add our default xmlns as it is different for
 * C2S/S2S/Component connections.
 */
Connection.prototype.addStreamNs = function(stanza) {
    for(var attr in this.streamNsAttrs) {
        if (!stanza.attrs[attr] &&
	    !(attr === 'xmlns' &&
	      this.streamNsAttrs[attr] === this.xmlns['']))
            stanza.attrs[attr] = this.streamNsAttrs[attr];
    }
    return stanza;
};

/**
 * Remove superfluous xmlns that were aleady declared in
 * our <stream:stream>
 */
Connection.prototype.rmXmlns = function(stanza) {
    for(var prefix in this.xmlns) {
        var attr = prefix ? 'xmlns:'+prefix : 'xmlns';
        if (stanza.attrs[attr] == this.xmlns[prefix])
            delete stanza.attrs[attr];
    }
    return stanza;
};


/**
 * Connection has been ended by remote, we will not get any incoming
 * 'data' events. Alternatively, used for 'error' event.
 */
Connection.prototype.onEnd = function() {
    this.stopParser();
    this.socket.end();
};

/**
 * XMPP-style end connection for user
 */
Connection.prototype.end = function() {
    if (this.socket.writable) {
        if (this.streamOpened) {
            this.socket.write('</stream:stream>');
            delete this.streamOpened;
	    /* wait for being called again upon 'end' from other side */
        } else {
            this.socket.end();
        }
    }
};

Connection.prototype.onClose = function() {
    if (!this.socket)
	/* A reconnect may have already been scheduled */
	return;

    delete this.socket;
    if (this.reconnect) {
	var self = this;
	setTimeout(function() {
	    self.socket = new net.Stream();
	    self.setupStream();
	    self.reconnect();
	}, this.reconnectDelay);
	console.log("Reconnect in", this.reconnectDelay);
	this.reconnectDelay += Math.ceil(Math.random() * 2000);
	if (this.reconnectDelay > MAX_RECONNECT_DELAY)
	    this.reconnectDelay = MAX_RECONNECT_DELAY;
    } else {
	this.emit('close');
    }
};

/**
 * End connection with stream error.
 * Emits 'error' event too.
 *
 * @param {String} condition XMPP error condition, see RFC3920 4.7.3. Defined Conditions
 * @param {String} text Optional error message
 */
Connection.prototype.error = function(condition, message) {
    this.emit('error', new Error(message));

    if (!this.socket || !this.socket.writable)
        return;

    if(!this.streamOpened)
        this.startStream(); /* RFC 3920, 4.7.1 stream-level errors rules */

    var e = new ltx.Element('stream:error');
    e.c(condition, { xmlns: NS_XMPP_STREAMS });
    if (message)
        e.c('text', { xmlns: NS_XMPP_STREAMS,
                      'xml:lang': 'en' }).
        t(message);

    this.send(e);
    this.end();
};

});

require.define("net",function(require,module,exports,__dirname,__filename,process,global){// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var events = require('events');
var stream = require('stream');
var EventEmitter = events.EventEmitter;
var util = require('util');
var assert = require('assert');
var cluster;

function noop() {}

var debug = function(x) {
  console.error('NET: ', util.format.apply(util, arguments).slice(0, 500));
};

exports.createServer = function() {
  return new Server(arguments[0], arguments[1]);
};


// Target API:
//
// var s = net.connect({port: 80, host: 'google.com'}, function() {
//   ...
// });
//
// There are various forms:
//
// connect(options, [cb])
// connect(port, [host], [cb])
// connect(path, [cb]);
//
exports.connect = exports.createConnection = function() {
  var args = normalizeConnectArgs(arguments);
  var s = new Socket(args[0]);
  return Socket.prototype.connect.apply(s, args);
};

// Returns an array [options] or [options, cb]
// It is the same as the argument of Socket.prototype.connect().
function normalizeConnectArgs(args) {
  var options = {};

  if (typeof args[0] === 'object') {
    // connect(options, [cb])
    options = args[0];
  } else {
    // connect(port, [host], [cb])
    options.port = args[0];
    if (typeof args[1] === 'string') {
      options.host = args[1];
    }
  }

  var cb = args[args.length - 1];
  return (typeof cb === 'function') ? [options, cb] : [options];
}
exports._normalizeConnectArgs = normalizeConnectArgs;


// called when creating new Socket, or when re-using a closed Socket
function initSocketHandle(self) {
  self.destroyed = false;
  self.errorEmitted = false;
  self.bytesRead = 0;
  self._bytesDispatched = 0;

  // Handle creation may be deferred to bind() or connect() time.
  if (self._handle) {
    self._handle.owner = self;
    self._handle.onread = onread;
  }
}

function Socket(options) {
  if (!(this instanceof Socket)) return new Socket(options);

  switch (typeof options) {
    case 'number':
      options = { fd: options }; // Legacy interface.
      break;
    case 'undefined':
      options = {};
      break;
  }

  stream.Duplex.call(this, options);
  this.readable = this.writable = false;

  if (options.handle) {
    this._handle = options.handle; // private
  } else {
    this.readable = this.writable = false;
//    this.readable = options.readable !== false;
//    this.writable = options.writable !== false;
  }

  this.onend = null;

  // shut down the socket when we're finished with it.
  this.on('finish', onSocketFinish);
  this.on('_socketEnd', onSocketEnd);

  initSocketHandle(this);

  this._pendingWrite = null;

  // default to *not* allowing half open sockets
  this.allowHalfOpen = options && options.allowHalfOpen || false;

  // if we have a handle, then start the flow of data into the
  // buffer.  if not, then this will happen when we connect
  if (this._handle && options.readable !== false)
    this.read(0);
}
util.inherits(Socket, stream.Duplex);

// the user has called .end(), and all the bytes have been
// sent out to the other side.
// If allowHalfOpen is false, or if the readable side has
// ended already, then destroy.
// If allowHalfOpen is true, then we need to do a shutdown,
// so that only the writable side will be cleaned up.
function onSocketFinish() {
  debug('onSocketFinish');
  if (this._readableState.ended) {
    debug('oSF: ended, destroy', this._readableState);
    return this.destroy();
  }

  debug('oSF: not ended, call shutdown()');

  // otherwise, just shutdown, or destroy() if not possible
  if (!this._handle || !this._handle.shutdown)
    return this.destroy();

  var shutdownReq = this._handle.shutdown();

  if (!shutdownReq)
    return this._destroy(errnoException(errno, 'shutdown'));

  shutdownReq.oncomplete = afterShutdown;
}


function afterShutdown(status, handle, req) {
  var self = handle.owner;

  debug('afterShutdown destroyed=%j', self.destroyed,
        self._readableState);

  // callback may come after call to destroy.
  if (self.destroyed)
    return;

  if (self._readableState.ended) {
    debug('readableState ended, destroying');
    self.destroy();
  } else {
    self.once('_socketEnd', self.destroy);
  }
}

// the EOF has been received, and no more bytes are coming.
// if the writable side has ended already, then clean everything
// up.
function onSocketEnd() {
  // XXX Should not have to do as much crap in this function.
  // ended should already be true, since this is called *after*
  // the EOF errno and onread has returned null to the _read cb.
  debug('onSocketEnd', this._readableState);
  this._readableState.ended = true;
  if (this._readableState.endEmitted) {
    this.readable = false;
  } else {
    this.once('end', function() {
      this.readable = false;
    });
    this.read(0);
  }

  if (!this.allowHalfOpen)
    this.destroySoon();
}

exports.Socket = Socket;
exports.Stream = Socket; // Legacy naming.

Socket.prototype.read = function(n) {
  if (n === 0)
    return stream.Readable.prototype.read.call(this, n);

  this.read = stream.Readable.prototype.read;
  this._consuming = true;
  return this.read(n);
};

Socket.prototype.listen = function() {
  debug('socket.listen');
  var self = this;
  self.on('connection', arguments[0]);
  listen(self, null, null, null);
};


Socket.prototype.setTimeout = function(msecs, callback) {
  if (msecs > 0 && !isNaN(msecs) && isFinite(msecs)) {
		this._timeout = setTimeout(this._onTimeout.bind(this), msec);
    if (callback) {
      this.once('timeout', callback);
    }
  } else if (msecs === 0) {
		clearTimeout(this._timeout);
    if (callback) {
      this.removeListener('timeout', callback);
    }
  }
};


Socket.prototype._onTimeout = function() {
  debug('_onTimeout');
  this.emit('timeout');
};


Socket.prototype.setNoDelay = function(enable) {
  // backwards compatibility: assume true when `enable` is omitted
  if (this._handle && this._handle.setNoDelay)
    this._handle.setNoDelay(typeof enable === 'undefined' ? true : !!enable);
};


Socket.prototype.setKeepAlive = function(setting, msecs) {
  if (this._handle && this._handle.setKeepAlive)
    this._handle.setKeepAlive(setting, ~~(msecs / 1000));
};


Socket.prototype.address = function() {
  if (this._handle && this._handle.getsockname) {
    return this._handle.getsockname();
  }
  return null;
};


Object.defineProperty(Socket.prototype, 'readyState', {
  get: function() {
    if (this._connecting) {
      return 'opening';
    } else if (this.readable && this.writable) {
      return 'open';
    } else if (this.readable && !this.writable) {
      return 'readOnly';
    } else if (!this.readable && this.writable) {
      return 'writeOnly';
    } else {
      return 'closed';
    }
  }
});


Object.defineProperty(Socket.prototype, 'bufferSize', {
  get: function() {
    if (this._handle) {
      return this._handle.writeQueueSize;
    }
  }
});


// Just call handle.readStart until we have enough in the buffer
Socket.prototype._read = function(n, callback) {
  debug('_read');
  if (this._connecting || !this._handle) {
    debug('_read wait for connection');
    this.once('connect', this._read.bind(this, n, callback));
    return;
  }

  assert(callback === this._readableState.onread);
  assert(this._readableState.reading = true);

  if (!this._handle.reading) {
    debug('Socket._read readStart');
    this._handle.reading = true;
    var r = this._handle.readStart();
    if (r)
      this._destroy(errnoException(errno, 'read'));
  } else {
    debug('readStart already has been called.');
  }
};


Socket.prototype.end = function(data, encoding) {
  stream.Duplex.prototype.end.call(this, data, encoding);
  this.writable = false;
  //DTRACE_NET_STREAM_END(this);

  // just in case we're waiting for an EOF.
  if (!this._readableState.endEmitted)
    this.read(0);
  return;
};


Socket.prototype.destroySoon = function() {
  if (this.writable)
    this.end();

  if (this._writableState.finishing || this._writableState.finished)
    this.destroy();
  else
    this.once('finish', this.destroy);
};


Socket.prototype._destroy = function(exception, cb) {
  debug('destroy');

  var self = this;

  function fireErrorCallbacks() {
    if (cb) cb(exception);
    if (exception && !self.errorEmitted) {
      process.nextTick(function() {
        self.emit('error', exception);
      });
      self.errorEmitted = true;
    }
  };

  if (this.destroyed) {
    debug('already destroyed, fire error callbacks');
    fireErrorCallbacks();
    return;
  }

  self._connecting = false;

  this.readable = this.writable = false;

	clearTimeout(this._timeout);

  debug('close');
  if (this._handle) {
    if (this !== process.stderr)
      debug('close handle');
    this._handle.close();
    this._handle.onread = noop;
    this._handle = null;
  }

  fireErrorCallbacks();

  process.nextTick(function() {
    debug('emit close');
    self.emit('close', exception ? true : false);
  });

  this.destroyed = true;

  if (this.server) {
    COUNTER_NET_SERVER_CONNECTION_CLOSE(this);
    debug('has server');
    this.server._connections--;
    if (this.server._emitCloseIfDrained) {
      this.server._emitCloseIfDrained();
    }
  }
};


Socket.prototype.destroy = function(exception) {
  debug('destroy', exception);
  this._destroy(exception);
};


// This function is called whenever the handle gets a
// buffer, or when there's an error reading.
function onread(buffer, offset, length) {
  var handle = this;
  var self = handle.owner;
  assert(handle === self._handle, 'handle != self._handle');

  var end = offset + length;
  debug('onread', global.errno, offset, length, end);

  if (buffer) {
    debug('got data');

    // read success.
    // In theory (and in practice) calling readStop right now
    // will prevent this from being called again until _read() gets
    // called again.

    // if we didn't get any bytes, that doesn't necessarily mean EOF.
    // wait for the next one.
    if (offset === end) {
      debug('not any data, keep waiting');
      return;
    }

    // if it's not enough data, we'll just call handle.readStart()
    // again right away.
    self.bytesRead += length;

    // Optimization: emit the original buffer with end points
    if (self.ondata) self.ondata(buffer, offset, end);
    else self._readableState.onread(null, buffer.slice(offset, end));

    if (handle.reading && !self._readableState.reading) {
      handle.reading = false;
      debug('readStop');
      var r = handle.readStop();
      if (r)
        self._destroy(errnoException(errno, 'read'));
    }

  } else if (errno == 'EOF') {
    debug('EOF');

    if (self._readableState.length === 0)
      self.readable = false;

    if (self.onend) self.once('end', self.onend);

    // send a null to the _read cb to signal the end of data.
    self._readableState.onread(null, null);

    // internal end event so that we know that the actual socket
    // is no longer readable, and we can start the shutdown
    // procedure. No need to wait for all the data to be consumed.
    self.emit('_socketEnd');
  } else {
    debug('error', errno);
    // Error
    if (errno == 'ECONNRESET') {
      self._destroy();
    } else {
      self._destroy(errnoException(errno, 'read'));
    }
  }
}


Socket.prototype._getpeername = function() {
  if (!this._handle || !this._handle.getpeername) {
    return {};
  }
  if (!this._peername) {
    this._peername = this._handle.getpeername();
    // getpeername() returns null on error
    if (this._peername === null) {
      return {};
    }
  }
  return this._peername;
};


Socket.prototype.__defineGetter__('remoteAddress', function() {
  return this._getpeername().address;
});


Socket.prototype.__defineGetter__('remotePort', function() {
  return this._getpeername().port;
});


Socket.prototype._getsockname = function() {
  if (!this._handle || !this._handle.getsockname) {
    return {};
  }
  if (!this._sockname) {
    this._sockname = this._handle.getsockname();
    if (this._sockname === null) {
      return {};
    }
  }
  return this._sockname;
};


Socket.prototype.__defineGetter__('localAddress', function() {
  return this._getsockname().address;
});


Socket.prototype.__defineGetter__('localPort', function() {
  return this._getsockname().port;
});


Socket.prototype.write = function(chunk, encoding, cb) {
	console.log("write called with " + chunk);
  if (typeof chunk !== 'string' && !Buffer.isBuffer(chunk))
    throw new TypeError('invalid data');
  return stream.Duplex.prototype.write.apply(this, arguments);
};


Socket.prototype._write = function(dataEncoding, cb) {
  // assert(Array.isArray(dataEncoding));
  var data = dataEncoding[0];
  var encoding = dataEncoding[1] || 'utf8';

  // If we are still connecting, then buffer this for later.
  // The Writable logic will buffer up any more writes while
  // waiting for this one to be done.
  if (this._connecting) {
    this._pendingWrite = dataEncoding;
    this.once('connect', function() {
      this._write(dataEncoding, cb);
    });
    return;
  }
  this._pendingWrite = null;

  if (!this._handle) {
    this._destroy(new Error('This socket is closed.'), cb);
    return false;
  }

  var enc = Buffer.isBuffer(data) ? 'buffer' : encoding;
  var writeReq = createWriteReq(this._handle, data, enc);

  if (!writeReq || typeof writeReq !== 'object')
    return this._destroy(errnoException(errno, 'write'), cb);

  writeReq.oncomplete = afterWrite;
  this._bytesDispatched += writeReq.bytes;

  // If it was entirely flushed, we can write some more right now.
  // However, if more is left in the queue, then wait until that clears.
  if (this._handle.writeQueueSize === 0)
    cb();
  else
    writeReq.cb = cb;
};

function createWriteReq(handle, data, encoding) {
  switch (encoding) {
    case 'buffer':
      return handle.writeBuffer(data);

    case 'utf8':
    case 'utf-8':
      return handle.writeUtf8String(data);

    case 'ascii':
      return handle.writeAsciiString(data);

    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return handle.writeUcs2String(data);

    default:
      return handle.writeBuffer(new Buffer(data, encoding));
  }
}


Socket.prototype.__defineGetter__('bytesWritten', function() {
  var bytes = this._bytesDispatched,
      state = this._writableState,
      pending = this._pendingWrite;

  state.buffer.forEach(function(el) {
    el = el[0];
    bytes += Buffer.byteLength(el[0], el[1]);
  });

  if (pending)
    bytes += Buffer.byteLength(pending[0], pending[1]);

  return bytes;
});


function afterWrite(status, handle, req) {
  var self = handle.owner;
  var state = self._writableState;
  if (self !== process.stderr && self !== process.stdout)
    debug('afterWrite', status, req);

  // callback may come after call to destroy.
  if (self.destroyed) {
    debug('afterWrite destroyed');
    return;
  }

  if (status) {
    debug('write failure', errnoException(errno, 'write'));
    self._destroy(errnoException(errno, 'write'), req.cb);
    return;
  }

  if (self !== process.stderr && self !== process.stdout)
    debug('afterWrite call cb');

  if (req.cb)
    req.cb.call(self);
}


function connect(self, address, port, addressType, localAddress) {
  // TODO return promise from Socket.prototype.connect which
  // wraps _connectReq.

  assert.ok(self._connecting);

  if (localAddress) {
    var r;
    if (addressType == 6) {
      r = self._handle.bind6(localAddress);
    } else {
      r = self._handle.bind(localAddress);
    }

    if (r) {
      self._destroy(errnoException(errno, 'bind'));
      return;
    }
  }
	
	self._handle.connect(address, port, function(result) {
		afterConnect(result, self, null /* req */, true, true);		
	});
}

ChromeTCP = function(fd) {
	this.fd = fd;
}

ChromeTCP.prototype.connect = function(address, port, callback) {
	chrome.socket.connect(this.fd, address, port, callback);
}

ChromeTCP.prototype.readStart = function() {
	chrome.socket.read(this.fd, null, function(readinfo) {
		console.log("read result " + readinfo.resultCode + " - read " + readinfo.data.byteLength + " bytes");
		if (readinfo.resultCode < 0) {
			global.errno = readinfo.resultCode;
			this.onread(null, 0, 0);
		} else if (readinfo.data.byteLength == 0) {
			global.errno = 'EOF';
			this.onread(readinfo.data, 0, 0);
		} else {
			this.onread(readinfo.data, 0 , readinfo.data.byteLength);
		}

		if (this.reading) {
			this.readStart();
		}
	}.bind(this));
}

ChromeTCP.prototype.readStop = function() {
	this.reading = false;
	return false;
}

ChromeTCP.prototype.close = function() {
	chrome.socket.disconnect(this.fd);
	chrome.socket.destroy(this.fd);
	this.reading = false;
	this.writing = false;
}

Socket.prototype.connect = function(options, cb) {
  if (typeof options !== 'object') {
    // Old API:
    // connect(port, [host], [cb])
    // connect(path, [cb]);
    var args = normalizeConnectArgs(arguments);
    return Socket.prototype.connect.apply(this, args);
  }

  if (this.destroyed) {
    this._readableState.reading = false;
    this._readableState.ended = false;
    this._writableState.ended = false;
    this._writableState.ending = false;
    this._writableState.finished = false;
    this._writableState.finishing = false;
    this.destroyed = false;
    this._handle = null;
  }

  var self = this;
  var pipe = !!options.path;

  if (!this._handle) {
		if (pipe) {
	    this._handle = createPipe();			
	    initSocketHandle(this);
		} else {
			chrome.socket.create('tcp', {}, function(createInfo) {
				this._handle = new ChromeTCP(createInfo.socketId);
		    initSocketHandle(this);
			}.bind(this));
		}
  }

  if (typeof cb === 'function') {
    self.once('connect', cb);
  }

  self._connecting = true;
  self.writable = true;

  if (pipe) {
    connect(self, options.path);

  } else if (!options.host) {
    debug('connect: missing host');
    connect(self, '127.0.0.1', options.port, 4);

  } else {
    var host = options.host;
    debug('connect: find host ' + host);
    require('dns').lookup(host, function(err, ip, addressType) {
      // It's possible we were destroyed while looking this up.
      // XXX it would be great if we could cancel the promise returned by
      // the look up.
      if (!self._connecting) return;

      if (err) {
        // net.createConnection() creates a net.Socket object and
        // immediately calls net.Socket.connect() on it (that's us).
        // There are no event listeners registered yet so defer the
        // error event to the next tick.
        process.nextTick(function() {
          self.emit('error', err);
          self._destroy();
        });
      } else {
        addressType = addressType || 4;

        // node_net.cc handles null host names graciously but user land
        // expects remoteAddress to have a meaningful value
        ip = ip || (addressType === 4 ? '127.0.0.1' : '0:0:0:0:0:0:0:1');

        connect(self, ip, options.port, addressType, options.localAddress);
      }
    });
  }
  return self;
};


Socket.prototype.ref = function() {
  if (this._handle)
    this._handle.ref();
};


Socket.prototype.unref = function() {
  if (this._handle)
    this._handle.unref();
};



function afterConnect(status, self, req, readable, writable) {
  // callback may come after call to destroy
  if (self.destroyed) {
    return;
  }

  debug('afterConnect');

  assert.ok(self._connecting);
  self._connecting = false;

  if (status == 0) {
    self.readable = readable;
    self.writable = writable;

    self.emit('connect');

    // start the first read, or get an immediate EOF.
    // this doesn't actually consume any bytes, because len=0.
    if (readable)
      self.read(0);

  } else {
    self._connecting = false;
    self._destroy(errnoException(status, 'connect'));
  }
}


function errnoException(errorno, syscall) {
  // TODO make this more compatible with ErrnoException from src/node.cc
  // Once all of Node is using this function the ErrnoException from
  // src/node.cc should be removed.
  var e = new Error(syscall + ' ' + errorno);
  e.errno = e.code = errorno;
  e.syscall = syscall;
  return e;
}




function Server(/* [ options, ] listener */) {
  if (!(this instanceof Server)) return new Server(arguments[0], arguments[1]);
  events.EventEmitter.call(this);

  var self = this;

  var options;

  if (typeof arguments[0] == 'function') {
    options = {};
    self.on('connection', arguments[0]);
  } else {
    options = arguments[0] || {};

    if (typeof arguments[1] == 'function') {
      self.on('connection', arguments[1]);
    }
  }

  this._connections = 0;

  // when server is using slaves .connections is not reliable
  // so null will be return if thats the case
  Object.defineProperty(this, 'connections', {
    get: function() {
      if (self._usingSlaves) {
        return null;
      }
      return self._connections;
    },
    set: function(val) {
      return (self._connections = val);
    },
    configurable: true, enumerable: true
  });

  this._handle = null;

  this.allowHalfOpen = options.allowHalfOpen || false;
}
util.inherits(Server, events.EventEmitter);
exports.Server = Server;


function toNumber(x) { return (x = Number(x)) >= 0 ? x : false; }


var createServerHandle = exports._createServerHandle =
    function(address, port, addressType, fd) {
  var r = 0;
  // assign handle in listen, and clean up if bind or listen fails
  var handle;

  if (typeof fd === 'number' && fd >= 0) {
    var tty_wrap = process.binding('tty_wrap');
    var type = tty_wrap.guessHandleType(fd);
    switch (type) {
      case 'PIPE':
        debug('listen pipe fd=' + fd);
        // create a PipeWrap
        handle = createPipe();
        handle.open(fd);
        handle.readable = true;
        handle.writable = true;
        break;

      default:
        // Not a fd we can listen on.  This will trigger an error.
        debug('listen invalid fd=' + fd + ' type=' + type);
        global.errno = 'EINVAL'; // hack, callers expect that errno is set
        handle = null;
        break;
    }
    return handle;

  } else if (port == -1 && addressType == -1) {
    handle = createPipe();
    if (process.platform === 'win32') {
      var instances = parseInt(process.env.NODE_PENDING_PIPE_INSTANCES);
      if (!isNaN(instances)) {
        handle.setPendingInstances(instances);
      }
    }
  } else {
    handle = createTCP();
  }

  if (address || port) {
    debug('bind to ' + address);
    if (addressType == 6) {
      r = handle.bind6(address, port);
    } else {
      r = handle.bind(address, port);
    }
  }

  if (r) {
    handle.close();
    handle = null;
  }

  return handle;
};


Server.prototype._listen2 = function(address, port, addressType, backlog, fd) {
  debug('listen2', address, port, addressType, backlog);
  var self = this;
  var r = 0;

  // If there is not yet a handle, we need to create one and bind.
  // In the case of a server sent via IPC, we don't need to do this.
  if (!self._handle) {
    debug('_listen2: create a handle');
    self._handle = createServerHandle(address, port, addressType, fd);
    if (!self._handle) {
      var error = errnoException(errno, 'listen');
      process.nextTick(function() {
        self.emit('error', error);
      });
      return;
    }
  } else {
    debug('_listen2: have a handle already');
  }

  self._handle.onconnection = onconnection;
  self._handle.owner = self;

  // Use a backlog of 512 entries. We pass 511 to the listen() call because
  // the kernel does: backlogsize = roundup_pow_of_two(backlogsize + 1);
  // which will thus give us a backlog of 512 entries.
  r = self._handle.listen(backlog || 511);

  if (r) {
    var ex = errnoException(errno, 'listen');
    self._handle.close();
    self._handle = null;
    process.nextTick(function() {
      self.emit('error', ex);
    });
    return;
  }

  // generate connection key, this should be unique to the connection
  this._connectionKey = addressType + ':' + address + ':' + port;

  process.nextTick(function() {
    self.emit('listening');
  });
};


function listen(self, address, port, addressType, backlog, fd) {
	//NOTE(willscott): Removed cluster dependency.
  //if (!cluster) cluster = require('cluster');
  //
  //if (cluster.isWorker) {
  //  cluster._getServer(self, address, port, addressType, fd, function(handle) {
  //    self._handle = handle;
  //    self._listen2(address, port, addressType, backlog, fd);
  //  });
  //} else {
    self._listen2(address, port, addressType, backlog, fd);
	//}
}


Server.prototype.listen = function() {
  var self = this;

  var lastArg = arguments[arguments.length - 1];
  if (typeof lastArg == 'function') {
    self.once('listening', lastArg);
  }

  var port = toNumber(arguments[0]);

  // The third optional argument is the backlog size.
  // When the ip is omitted it can be the second argument.
  var backlog = toNumber(arguments[1]) || toNumber(arguments[2]);

  var TCP = process.binding('tcp_wrap').TCP;

  if (arguments.length == 0 || typeof arguments[0] == 'function') {
    // Bind to a random port.
    listen(self, '0.0.0.0', 0, null, backlog);

  } else if (arguments[0] && typeof arguments[0] === 'object') {
    var h = arguments[0];
    if (h._handle) {
      h = h._handle;
    } else if (h.handle) {
      h = h.handle;
    }
    if (h instanceof TCP) {
      self._handle = h;
      listen(self, null, -1, -1, backlog);
    } else if (typeof h.fd === 'number' && h.fd >= 0) {
      listen(self, null, null, null, backlog, h.fd);
    } else {
      throw new Error('Invalid listen argument: ' + h);
    }
  } else if (isPipeName(arguments[0])) {
    // UNIX socket or Windows pipe.
    var pipeName = self._pipeName = arguments[0];
    listen(self, pipeName, -1, -1, backlog);

  } else if (typeof arguments[1] == 'undefined' ||
             typeof arguments[1] == 'function' ||
             typeof arguments[1] == 'number') {
    // The first argument is the port, no IP given.
    listen(self, '0.0.0.0', port, 4, backlog);

  } else {
    // The first argument is the port, the second an IP.
    require('dns').lookup(arguments[1], function(err, ip, addressType) {
      if (err) {
        self.emit('error', err);
      } else {
        listen(self, ip || '0.0.0.0', port, ip ? addressType : 4, backlog);
      }
    });
  }
  return self;
};

Server.prototype.address = function() {
  if (this._handle && this._handle.getsockname) {
    return this._handle.getsockname();
  } else if (this._pipeName) {
    return this._pipeName;
  } else {
    return null;
  }
};

function onconnection(clientHandle) {
  var handle = this;
  var self = handle.owner;

  debug('onconnection');

  if (!clientHandle) {
    self.emit('error', errnoException(errno, 'accept'));
    return;
  }

  if (self.maxConnections && self._connections >= self.maxConnections) {
    clientHandle.close();
    return;
  }

  var socket = new Socket({
    handle: clientHandle,
    allowHalfOpen: self.allowHalfOpen
  });
  socket.readable = socket.writable = true;


  self._connections++;
  socket.server = self;

  //DTRACE_NET_SERVER_CONNECTION(socket);
  //COUNTER_NET_SERVER_CONNECTION(socket);
  self.emit('connection', socket);
  socket.emit('connect');
}


Server.prototype.close = function(cb) {
  if (!this._handle) {
    // Throw error. Follows net_legacy behaviour.
    throw new Error('Not running');
  }

  if (cb) {
    this.once('close', cb);
  }
  this._handle.close();
  this._handle = null;
  this._emitCloseIfDrained();

  // fetch new socket lists
  if (this._usingSlaves) {
    this._slaves.forEach(function(socketList) {
      if (socketList.list.length === 0) return;
      socketList.update();
    });
  }

  return this;
};

Server.prototype._emitCloseIfDrained = function() {
  debug('SERVER _emitCloseIfDrained');
  var self = this;

  if (self._handle || self._connections) {
    debug('SERVER handle? %j   connections? %d',
          !!self._handle, self._connections);
    return;
  }

  process.nextTick(function() {
    debug('SERVER: emit close');
    self.emit('close');
  });
};


Server.prototype.listenFD = function(fd, type) {
	console.log("ListenFD Called!! Should Be Deprecated.");
	console.trace();
  return this.listen({ fd: fd });
}

// when sending a socket using fork IPC this function is executed
Server.prototype._setupSlave = function(socketList) {
  if (!this._usingSlaves) {
    this._usingSlaves = true;
    this._slaves = [];
  }
  this._slaves.push(socketList);
};

Server.prototype.ref = function() {
  if (this._handle)
    this._handle.ref();
};

Server.prototype.unref = function() {
  if (this._handle)
    this._handle.unref();
};

});

require.define("events",function(require,module,exports,__dirname,__filename,process,global){if (!process.EventEmitter) process.EventEmitter = function () {};

var EventEmitter = exports.EventEmitter = process.EventEmitter;
var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.prototype.toString.call(xs) === '[object Array]'
    }
;
function indexOf (xs, x) {
    if (xs.indexOf) return xs.indexOf(x);
    for (var i = 0; i < xs.length; i++) {
        if (x === xs[i]) return i;
    }
    return -1;
}

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!this._events) this._events = {};
  this._events.maxListeners = n;
};


EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (isArray(this._events.error) && !this._events.error.length))
    {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var args = Array.prototype.slice.call(arguments, 1);

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // Check for listener leak
    if (!this._events[type].warned) {
      var m;
      if (this._events.maxListeners !== undefined) {
        m = this._events.maxListeners;
      } else {
        m = defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' +
                      'leak detected. %d listeners added. ' +
                      'Use emitter.setMaxListeners() to increase limit.',
                      this._events[type].length);
        console.trace();
      }
    }

    // If we've already got an array, just append.
    this._events[type].push(listener);
  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  var self = this;
  self.on(type, function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  });

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var i = indexOf(list, listener);
    if (i < 0) return this;
    list.splice(i, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (this._events[type] === listener) {
    delete this._events[type];
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};

});

require.define("stream",function(require,module,exports,__dirname,__filename,process,global){var events = require('events');
var util = require('util');

function Stream() {
  events.EventEmitter.call(this);
}
util.inherits(Stream, events.EventEmitter);
module.exports = Stream;
// Backwards-compat with node 0.4.x
Stream.Readable = require('_stream_readable');
Stream.Writable = require('_stream_writable');
Stream.Duplex = require('_stream_duplex');
Stream.Stream = Stream;

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once, and
  // only when all sources have ended.
  if (!dest._isStdio && (!options || options.end !== false)) {
    dest._pipeCount = dest._pipeCount || 0;
    dest._pipeCount++;

    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest._pipeCount--;

    // remove the listeners
    cleanup();

    if (dest._pipeCount > 0) {
      // waiting for other incoming streams to end.
      return;
    }

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest._pipeCount--;

    // remove the listeners
    cleanup();

    if (dest._pipeCount > 0) {
      // waiting for other incoming streams to end.
      return;
    }

    dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (this.listeners('error').length === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('end', cleanup);
    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('end', cleanup);
  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

});

require.define("util",function(require,module,exports,__dirname,__filename,process,global){var events = require('events');

exports.isArray = isArray;
exports.isDate = function(obj){return Object.prototype.toString.call(obj) === '[object Date]'};
exports.isRegExp = function(obj){return Object.prototype.toString.call(obj) === '[object RegExp]'};


exports.print = function () {};
exports.puts = function () {};
exports.debug = function() {};

exports.inspect = function(obj, showHidden, depth, colors) {
  var seen = [];

  var stylize = function(str, styleType) {
    // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
    var styles =
        { 'bold' : [1, 22],
          'italic' : [3, 23],
          'underline' : [4, 24],
          'inverse' : [7, 27],
          'white' : [37, 39],
          'grey' : [90, 39],
          'black' : [30, 39],
          'blue' : [34, 39],
          'cyan' : [36, 39],
          'green' : [32, 39],
          'magenta' : [35, 39],
          'red' : [31, 39],
          'yellow' : [33, 39] };

    var style =
        { 'special': 'cyan',
          'number': 'blue',
          'boolean': 'yellow',
          'undefined': 'grey',
          'null': 'bold',
          'string': 'green',
          'date': 'magenta',
          // "name": intentionally not styling
          'regexp': 'red' }[styleType];

    if (style) {
      return '\033[' + styles[style][0] + 'm' + str +
             '\033[' + styles[style][1] + 'm';
    } else {
      return str;
    }
  };
  if (! colors) {
    stylize = function(str, styleType) { return str; };
  }

  function format(value, recurseTimes) {
    // Provide a hook for user-specified inspect functions.
    // Check that value is an object with an inspect function on it
    if (value && typeof value.inspect === 'function' &&
        // Filter out the util module, it's inspect function is special
        value !== exports &&
        // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
      return value.inspect(recurseTimes);
    }

    // Primitive types cannot have properties
    switch (typeof value) {
      case 'undefined':
        return stylize('undefined', 'undefined');

      case 'string':
        var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                                 .replace(/'/g, "\\'")
                                                 .replace(/\\"/g, '"') + '\'';
        return stylize(simple, 'string');

      case 'number':
        return stylize('' + value, 'number');

      case 'boolean':
        return stylize('' + value, 'boolean');
    }
    // For some reason typeof null is "object", so special case here.
    if (value === null) {
      return stylize('null', 'null');
    }

    // Look up the keys of the object.
    var visible_keys = Object_keys(value);
    var keys = showHidden ? Object_getOwnPropertyNames(value) : visible_keys;

    // Functions without properties can be shortcutted.
    if (typeof value === 'function' && keys.length === 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        var name = value.name ? ': ' + value.name : '';
        return stylize('[Function' + name + ']', 'special');
      }
    }

    // Dates without properties can be shortcutted
    if (isDate(value) && keys.length === 0) {
      return stylize(value.toUTCString(), 'date');
    }

    var base, type, braces;
    // Determine the object type
    if (isArray(value)) {
      type = 'Array';
      braces = ['[', ']'];
    } else {
      type = 'Object';
      braces = ['{', '}'];
    }

    // Make functions say that they are functions
    if (typeof value === 'function') {
      var n = value.name ? ': ' + value.name : '';
      base = (isRegExp(value)) ? ' ' + value : ' [Function' + n + ']';
    } else {
      base = '';
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
      base = ' ' + value.toUTCString();
    }

    if (keys.length === 0) {
      return braces[0] + base + braces[1];
    }

    if (recurseTimes < 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        return stylize('[Object]', 'special');
      }
    }

    seen.push(value);

    var output = keys.map(function(key) {
      var name, str;
      if (value.__lookupGetter__) {
        if (value.__lookupGetter__(key)) {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Getter/Setter]', 'special');
          } else {
            str = stylize('[Getter]', 'special');
          }
        } else {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Setter]', 'special');
          }
        }
      }
      if (visible_keys.indexOf(key) < 0) {
        name = '[' + key + ']';
      }
      if (!str) {
        if (seen.indexOf(value[key]) < 0) {
          if (recurseTimes === null) {
            str = format(value[key]);
          } else {
            str = format(value[key], recurseTimes - 1);
          }
          if (str.indexOf('\n') > -1) {
            if (isArray(value)) {
              str = str.split('\n').map(function(line) {
                return '  ' + line;
              }).join('\n').substr(2);
            } else {
              str = '\n' + str.split('\n').map(function(line) {
                return '   ' + line;
              }).join('\n');
            }
          }
        } else {
          str = stylize('[Circular]', 'special');
        }
      }
      if (typeof name === 'undefined') {
        if (type === 'Array' && key.match(/^\d+$/)) {
          return str;
        }
        name = JSON.stringify('' + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
          name = name.substr(1, name.length - 2);
          name = stylize(name, 'name');
        } else {
          name = name.replace(/'/g, "\\'")
                     .replace(/\\"/g, '"')
                     .replace(/(^"|"$)/g, "'");
          name = stylize(name, 'string');
        }
      }

      return name + ': ' + str;
    });

    seen.pop();

    var numLinesEst = 0;
    var length = output.reduce(function(prev, cur) {
      numLinesEst++;
      if (cur.indexOf('\n') >= 0) numLinesEst++;
      return prev + cur.length + 1;
    }, 0);

    if (length > 50) {
      output = braces[0] +
               (base === '' ? '' : base + '\n ') +
               ' ' +
               output.join(',\n  ') +
               ' ' +
               braces[1];

    } else {
      output = braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }

    return output;
  }
  return format(obj, (typeof depth === 'undefined' ? 2 : depth));
};


function isArray(ar) {
  return ar instanceof Array ||
         Array.isArray(ar) ||
         (ar && ar !== Object.prototype && isArray(ar.__proto__));
}


function isRegExp(re) {
  return re instanceof RegExp ||
    (typeof re === 'object' && Object.prototype.toString.call(re) === '[object RegExp]');
}


function isDate(d) {
  if (d instanceof Date) return true;
  if (typeof d !== 'object') return false;
  var properties = Date.prototype && Object_getOwnPropertyNames(Date.prototype);
  var proto = d.__proto__ && Object_getOwnPropertyNames(d.__proto__);
  return JSON.stringify(proto) === JSON.stringify(properties);
}

function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}

exports.log = function (msg) {};

exports.pump = null;

var Object_keys = Object.keys || function (obj) {
    var res = [];
    for (var key in obj) res.push(key);
    return res;
};

var Object_getOwnPropertyNames = Object.getOwnPropertyNames || function (obj) {
    var res = [];
    for (var key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) res.push(key);
    }
    return res;
};

var Object_create = Object.create || function (prototype, properties) {
    // from es5-shim
    var object;
    if (prototype === null) {
        object = { '__proto__' : null };
    }
    else {
        if (typeof prototype !== 'object') {
            throw new TypeError(
                'typeof prototype[' + (typeof prototype) + '] != \'object\''
            );
        }
        var Type = function () {};
        Type.prototype = prototype;
        object = new Type();
        object.__proto__ = prototype;
    }
    if (typeof properties !== 'undefined' && Object.defineProperties) {
        Object.defineProperties(object, properties);
    }
    return object;
};

exports.inherits = function(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object_create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (typeof f !== 'string') {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(exports.inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j': return JSON.stringify(args[i++]);
      default:
        return x;
    }
  });
  for(var x = args[i]; i < len; x = args[++i]){
    if (x === null || typeof x !== 'object') {
      str += ' ' + x;
    } else {
      str += ' ' + exports.inspect(x);
    }
  }
  return str;
};

});

require.define("assert",function(require,module,exports,__dirname,__filename,process,global){// UTILITY
var util = require('util');
var Buffer = require("buffer").Buffer;
var pSlice = Array.prototype.slice;

function objectKeys(object) {
  if (Object.keys) return Object.keys(object);
  var result = [];
  for (var name in object) {
    if (Object.prototype.hasOwnProperty.call(object, name)) {
      result.push(name);
    }
  }
  return result;
}

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.message = options.message;
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
};
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (value === undefined) {
    return '' + value;
  }
  if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
    return value.toString();
  }
  if (typeof value === 'function' || value instanceof RegExp) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (typeof s == 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

assert.AssertionError.prototype.toString = function() {
  if (this.message) {
    return [this.name + ':', this.message].join(' ');
  } else {
    return [
      this.name + ':',
      truncate(JSON.stringify(this.actual, replacer), 128),
      this.operator,
      truncate(JSON.stringify(this.expected, replacer), 128)
    ].join(' ');
  }
};

// assert.AssertionError instanceof Error

assert.AssertionError.__proto__ = Error.prototype;

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!!!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (Buffer.isBuffer(actual) && Buffer.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (typeof actual != 'object' && typeof expected != 'object') {
    return actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b),
        key, i;
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (expected instanceof RegExp) {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail('Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail('Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};

});

require.define("buffer",function(require,module,exports,__dirname,__filename,process,global){module.exports = require("buffer-browserify")
});

require.define("/node_modules/buffer-browserify/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"index.js","browserify":"index.js"}
});

require.define("/node_modules/buffer-browserify/index.js",function(require,module,exports,__dirname,__filename,process,global){function SlowBuffer (size) {
    this.length = size;
};

var assert = require('assert');

exports.INSPECT_MAX_BYTES = 50;


function toHex(n) {
  if (n < 16) return '0' + n.toString(16);
  return n.toString(16);
}

function utf8ToBytes(str) {
  var byteArray = [];
  for (var i = 0; i < str.length; i++)
    if (str.charCodeAt(i) <= 0x7F)
      byteArray.push(str.charCodeAt(i));
    else {
      var h = encodeURIComponent(str.charAt(i)).substr(1).split('%');
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16));
    }

  return byteArray;
}

function asciiToBytes(str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++ )
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push( str.charCodeAt(i) & 0xFF );

  return byteArray;
}

function base64ToBytes(str) {
  return require("base64-js").toByteArray(str);
}

SlowBuffer.byteLength = function (str, encoding) {
  switch (encoding || "utf8") {
    case 'hex':
      return str.length / 2;

    case 'utf8':
    case 'utf-8':
      return utf8ToBytes(str).length;

    case 'ascii':
      return str.length;

    case 'base64':
      return base64ToBytes(str).length;

    default:
      throw new Error('Unknown encoding');
  }
};

function blitBuffer(src, dst, offset, length) {
  var pos, i = 0;
  while (i < length) {
    if ((i+offset >= dst.length) || (i >= src.length))
      break;

    dst[i + offset] = src[i];
    i++;
  }
  return i;
}

SlowBuffer.prototype.utf8Write = function (string, offset, length) {
  var bytes, pos;
  return SlowBuffer._charsWritten =  blitBuffer(utf8ToBytes(string), this, offset, length);
};

SlowBuffer.prototype.asciiWrite = function (string, offset, length) {
  var bytes, pos;
  return SlowBuffer._charsWritten =  blitBuffer(asciiToBytes(string), this, offset, length);
};

SlowBuffer.prototype.base64Write = function (string, offset, length) {
  var bytes, pos;
  return SlowBuffer._charsWritten = blitBuffer(base64ToBytes(string), this, offset, length);
};

SlowBuffer.prototype.base64Slice = function (start, end) {
  var bytes = Array.prototype.slice.apply(this, arguments)
  return require("base64-js").fromByteArray(bytes);
}

function decodeUtf8Char(str) {
  try {
    return decodeURIComponent(str);
  } catch (err) {
    return String.fromCharCode(0xFFFD); // UTF 8 invalid char
  }
}

SlowBuffer.prototype.utf8Slice = function () {
  var bytes = Array.prototype.slice.apply(this, arguments);
  var res = "";
  var tmp = "";
  var i = 0;
  while (i < bytes.length) {
    if (bytes[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(bytes[i]);
      tmp = "";
    } else
      tmp += "%" + bytes[i].toString(16);

    i++;
  }

  return res + decodeUtf8Char(tmp);
}

SlowBuffer.prototype.asciiSlice = function () {
  var bytes = Array.prototype.slice.apply(this, arguments);
  var ret = "";
  for (var i = 0; i < bytes.length; i++)
    ret += String.fromCharCode(bytes[i]);
  return ret;
}

SlowBuffer.prototype.inspect = function() {
  var out = [],
      len = this.length;
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i]);
    if (i == exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...';
      break;
    }
  }
  return '<SlowBuffer ' + out.join(' ') + '>';
};


SlowBuffer.prototype.hexSlice = function(start, end) {
  var len = this.length;

  if (!start || start < 0) start = 0;
  if (!end || end < 0 || end > len) end = len;

  var out = '';
  for (var i = start; i < end; i++) {
    out += toHex(this[i]);
  }
  return out;
};


SlowBuffer.prototype.toString = function(encoding, start, end) {
  encoding = String(encoding || 'utf8').toLowerCase();
  start = +start || 0;
  if (typeof end == 'undefined') end = this.length;

  // Fastpath empty strings
  if (+end == start) {
    return '';
  }

  switch (encoding) {
    case 'hex':
      return this.hexSlice(start, end);

    case 'utf8':
    case 'utf-8':
      return this.utf8Slice(start, end);

    case 'ascii':
      return this.asciiSlice(start, end);

    case 'binary':
      return this.binarySlice(start, end);

    case 'base64':
      return this.base64Slice(start, end);

    case 'ucs2':
    case 'ucs-2':
      return this.ucs2Slice(start, end);

    default:
      throw new Error('Unknown encoding');
  }
};


SlowBuffer.prototype.hexWrite = function(string, offset, length) {
  offset = +offset || 0;
  var remaining = this.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = +length;
    if (length > remaining) {
      length = remaining;
    }
  }

  // must be an even number of digits
  var strLen = string.length;
  if (strLen % 2) {
    throw new Error('Invalid hex string');
  }
  if (length > strLen / 2) {
    length = strLen / 2;
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16);
    if (isNaN(byte)) throw new Error('Invalid hex string');
    this[offset + i] = byte;
  }
  SlowBuffer._charsWritten = i * 2;
  return i;
};


SlowBuffer.prototype.write = function(string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length;
      length = undefined;
    }
  } else {  // legacy
    var swap = encoding;
    encoding = offset;
    offset = length;
    length = swap;
  }

  offset = +offset || 0;
  var remaining = this.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = +length;
    if (length > remaining) {
      length = remaining;
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase();

  switch (encoding) {
    case 'hex':
      return this.hexWrite(string, offset, length);

    case 'utf8':
    case 'utf-8':
      return this.utf8Write(string, offset, length);

    case 'ascii':
      return this.asciiWrite(string, offset, length);

    case 'binary':
      return this.binaryWrite(string, offset, length);

    case 'base64':
      return this.base64Write(string, offset, length);

    case 'ucs2':
    case 'ucs-2':
      return this.ucs2Write(string, offset, length);

    default:
      throw new Error('Unknown encoding');
  }
};


// slice(start, end)
SlowBuffer.prototype.slice = function(start, end) {
  if (end === undefined) end = this.length;

  if (end > this.length) {
    throw new Error('oob');
  }
  if (start > end) {
    throw new Error('oob');
  }

  return new Buffer(this, end - start, +start);
};

SlowBuffer.prototype.copy = function(target, targetstart, sourcestart, sourceend) {
  var temp = [];
  for (var i=sourcestart; i<sourceend; i++) {
    assert.ok(typeof this[i] !== 'undefined', "copying undefined buffer bytes!");
    temp.push(this[i]);
  }

  for (var i=targetstart; i<targetstart+temp.length; i++) {
    target[i] = temp[i-targetstart];
  }
};

function coerce(length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length);
  return length < 0 ? 0 : length;
}


// Buffer

function Buffer(subject, encoding, offset) {
  if (!(this instanceof Buffer)) {
    return new Buffer(subject, encoding, offset);
  }

  var type;

  // Are we slicing?
  if (typeof offset === 'number') {
    this.length = coerce(encoding);
    this.parent = subject;
    this.offset = offset;
  } else {
    // Find the length
    switch (type = typeof subject) {
      case 'number':
        this.length = coerce(subject);
        break;

      case 'string':
        this.length = Buffer.byteLength(subject, encoding);
        break;

      case 'object': // Assume object is an array
        this.length = coerce(subject.length);
        break;

      default:
        throw new Error('First argument needs to be a number, ' +
                        'array or string.');
    }

    if (this.length > Buffer.poolSize) {
      // Big buffer, just alloc one.
      this.parent = new SlowBuffer(this.length);
      this.offset = 0;

    } else {
      // Small buffer.
      if (!pool || pool.length - pool.used < this.length) allocPool();
      this.parent = pool;
      this.offset = pool.used;
      pool.used += this.length;
    }

    // Treat array-ish objects as a byte array.
    if (isArrayIsh(subject)) {
      for (var i = 0; i < this.length; i++) {
        this.parent[i + this.offset] = subject[i];
      }
    } else if (type == 'string') {
      // We are a string
      this.length = this.write(subject, 0, encoding);
    }
  }

}

function isArrayIsh(subject) {
  return Array.isArray(subject) || Buffer.isBuffer(subject) ||
         subject && typeof subject === 'object' &&
         typeof subject.length === 'number';
}

exports.SlowBuffer = SlowBuffer;
exports.Buffer = Buffer;

Buffer.poolSize = 8 * 1024;
var pool;

function allocPool() {
  pool = new SlowBuffer(Buffer.poolSize);
  pool.used = 0;
}


// Static methods
Buffer.isBuffer = function isBuffer(b) {
  return b instanceof Buffer || b instanceof SlowBuffer;
};

Buffer.concat = function (list, totalLength) {
  if (!Array.isArray(list)) {
    throw new Error("Usage: Buffer.concat(list, [totalLength])\n \
      list should be an Array.");
  }

  if (list.length === 0) {
    return new Buffer(0);
  } else if (list.length === 1) {
    return list[0];
  }

  if (typeof totalLength !== 'number') {
    totalLength = 0;
    for (var i = 0; i < list.length; i++) {
      var buf = list[i];
      totalLength += buf.length;
    }
  }

  var buffer = new Buffer(totalLength);
  var pos = 0;
  for (var i = 0; i < list.length; i++) {
    var buf = list[i];
    buf.copy(buffer, pos);
    pos += buf.length;
  }
  return buffer;
};

// Inspect
Buffer.prototype.inspect = function inspect() {
  var out = [],
      len = this.length;

  for (var i = 0; i < len; i++) {
    out[i] = toHex(this.parent[i + this.offset]);
    if (i == exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...';
      break;
    }
  }

  return '<Buffer ' + out.join(' ') + '>';
};


Buffer.prototype.get = function get(i) {
  if (i < 0 || i >= this.length) throw new Error('oob');
  return this.parent[this.offset + i];
};


Buffer.prototype.set = function set(i, v) {
  if (i < 0 || i >= this.length) throw new Error('oob');
  return this.parent[this.offset + i] = v;
};


// write(string, offset = 0, length = buffer.length-offset, encoding = 'utf8')
Buffer.prototype.write = function(string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length;
      length = undefined;
    }
  } else {  // legacy
    var swap = encoding;
    encoding = offset;
    offset = length;
    length = swap;
  }

  offset = +offset || 0;
  var remaining = this.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = +length;
    if (length > remaining) {
      length = remaining;
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase();

  var ret;
  switch (encoding) {
    case 'hex':
      ret = this.parent.hexWrite(string, this.offset + offset, length);
      break;

    case 'utf8':
    case 'utf-8':
      ret = this.parent.utf8Write(string, this.offset + offset, length);
      break;

    case 'ascii':
      ret = this.parent.asciiWrite(string, this.offset + offset, length);
      break;

    case 'binary':
      ret = this.parent.binaryWrite(string, this.offset + offset, length);
      break;

    case 'base64':
      // Warning: maxLength not taken into account in base64Write
      ret = this.parent.base64Write(string, this.offset + offset, length);
      break;

    case 'ucs2':
    case 'ucs-2':
      ret = this.parent.ucs2Write(string, this.offset + offset, length);
      break;

    default:
      throw new Error('Unknown encoding');
  }

  Buffer._charsWritten = SlowBuffer._charsWritten;

  return ret;
};


// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function(encoding, start, end) {
  encoding = String(encoding || 'utf8').toLowerCase();

  if (typeof start == 'undefined' || start < 0) {
    start = 0;
  } else if (start > this.length) {
    start = this.length;
  }

  if (typeof end == 'undefined' || end > this.length) {
    end = this.length;
  } else if (end < 0) {
    end = 0;
  }

  start = start + this.offset;
  end = end + this.offset;

  switch (encoding) {
    case 'hex':
      return this.parent.hexSlice(start, end);

    case 'utf8':
    case 'utf-8':
      return this.parent.utf8Slice(start, end);

    case 'ascii':
      return this.parent.asciiSlice(start, end);

    case 'binary':
      return this.parent.binarySlice(start, end);

    case 'base64':
      return this.parent.base64Slice(start, end);

    case 'ucs2':
    case 'ucs-2':
      return this.parent.ucs2Slice(start, end);

    default:
      throw new Error('Unknown encoding');
  }
};


// byteLength
Buffer.byteLength = SlowBuffer.byteLength;


// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill(value, start, end) {
  value || (value = 0);
  start || (start = 0);
  end || (end = this.length);

  if (typeof value === 'string') {
    value = value.charCodeAt(0);
  }
  if (!(typeof value === 'number') || isNaN(value)) {
    throw new Error('value is not a number');
  }

  if (end < start) throw new Error('end < start');

  // Fill 0 bytes; we're done
  if (end === start) return 0;
  if (this.length == 0) return 0;

  if (start < 0 || start >= this.length) {
    throw new Error('start out of bounds');
  }

  if (end < 0 || end > this.length) {
    throw new Error('end out of bounds');
  }

  return this.parent.fill(value,
                          start + this.offset,
                          end + this.offset);
};


// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function(target, target_start, start, end) {
  var source = this;
  start || (start = 0);
  end || (end = this.length);
  target_start || (target_start = 0);

  if (end < start) throw new Error('sourceEnd < sourceStart');

  // Copy 0 bytes; we're done
  if (end === start) return 0;
  if (target.length == 0 || source.length == 0) return 0;

  if (target_start < 0 || target_start >= target.length) {
    throw new Error('targetStart out of bounds');
  }

  if (start < 0 || start >= source.length) {
    throw new Error('sourceStart out of bounds');
  }

  if (end < 0 || end > source.length) {
    throw new Error('sourceEnd out of bounds');
  }

  // Are we oob?
  if (end > this.length) {
    end = this.length;
  }

  if (target.length - target_start < end - start) {
    end = target.length - target_start + start;
  }

  return this.parent.copy(target.parent,
                          target_start + target.offset,
                          start + this.offset,
                          end + this.offset);
};


// slice(start, end)
Buffer.prototype.slice = function(start, end) {
  if (end === undefined) end = this.length;
  if (end > this.length) throw new Error('oob');
  if (start > end) throw new Error('oob');

  return new Buffer(this.parent, end - start, +start + this.offset);
};


// Legacy methods for backwards compatibility.

Buffer.prototype.utf8Slice = function(start, end) {
  return this.toString('utf8', start, end);
};

Buffer.prototype.binarySlice = function(start, end) {
  return this.toString('binary', start, end);
};

Buffer.prototype.asciiSlice = function(start, end) {
  return this.toString('ascii', start, end);
};

Buffer.prototype.utf8Write = function(string, offset) {
  return this.write(string, offset, 'utf8');
};

Buffer.prototype.binaryWrite = function(string, offset) {
  return this.write(string, offset, 'binary');
};

Buffer.prototype.asciiWrite = function(string, offset) {
  return this.write(string, offset, 'ascii');
};

Buffer.prototype.readUInt8 = function(offset, noAssert) {
  var buffer = this;

  if (!noAssert) {
    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset < buffer.length,
        'Trying to read beyond buffer length');
  }

  return buffer.parent[buffer.offset + offset];
};

function readUInt16(buffer, offset, isBigEndian, noAssert) {
  var val = 0;


  if (!noAssert) {
    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 1 < buffer.length,
        'Trying to read beyond buffer length');
  }

  if (isBigEndian) {
    val = buffer.parent[buffer.offset + offset] << 8;
    val |= buffer.parent[buffer.offset + offset + 1];
  } else {
    val = buffer.parent[buffer.offset + offset];
    val |= buffer.parent[buffer.offset + offset + 1] << 8;
  }

  return val;
}

Buffer.prototype.readUInt16LE = function(offset, noAssert) {
  return readUInt16(this, offset, false, noAssert);
};

Buffer.prototype.readUInt16BE = function(offset, noAssert) {
  return readUInt16(this, offset, true, noAssert);
};

function readUInt32(buffer, offset, isBigEndian, noAssert) {
  var val = 0;

  if (!noAssert) {
    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 3 < buffer.length,
        'Trying to read beyond buffer length');
  }

  if (isBigEndian) {
    val = buffer.parent[buffer.offset + offset + 1] << 16;
    val |= buffer.parent[buffer.offset + offset + 2] << 8;
    val |= buffer.parent[buffer.offset + offset + 3];
    val = val + (buffer.parent[buffer.offset + offset] << 24 >>> 0);
  } else {
    val = buffer.parent[buffer.offset + offset + 2] << 16;
    val |= buffer.parent[buffer.offset + offset + 1] << 8;
    val |= buffer.parent[buffer.offset + offset];
    val = val + (buffer.parent[buffer.offset + offset + 3] << 24 >>> 0);
  }

  return val;
}

Buffer.prototype.readUInt32LE = function(offset, noAssert) {
  return readUInt32(this, offset, false, noAssert);
};

Buffer.prototype.readUInt32BE = function(offset, noAssert) {
  return readUInt32(this, offset, true, noAssert);
};


/*
 * Signed integer types, yay team! A reminder on how two's complement actually
 * works. The first bit is the signed bit, i.e. tells us whether or not the
 * number should be positive or negative. If the two's complement value is
 * positive, then we're done, as it's equivalent to the unsigned representation.
 *
 * Now if the number is positive, you're pretty much done, you can just leverage
 * the unsigned translations and return those. Unfortunately, negative numbers
 * aren't quite that straightforward.
 *
 * At first glance, one might be inclined to use the traditional formula to
 * translate binary numbers between the positive and negative values in two's
 * complement. (Though it doesn't quite work for the most negative value)
 * Mainly:
 *  - invert all the bits
 *  - add one to the result
 *
 * Of course, this doesn't quite work in Javascript. Take for example the value
 * of -128. This could be represented in 16 bits (big-endian) as 0xff80. But of
 * course, Javascript will do the following:
 *
 * > ~0xff80
 * -65409
 *
 * Whoh there, Javascript, that's not quite right. But wait, according to
 * Javascript that's perfectly correct. When Javascript ends up seeing the
 * constant 0xff80, it has no notion that it is actually a signed number. It
 * assumes that we've input the unsigned value 0xff80. Thus, when it does the
 * binary negation, it casts it into a signed value, (positive 0xff80). Then
 * when you perform binary negation on that, it turns it into a negative number.
 *
 * Instead, we're going to have to use the following general formula, that works
 * in a rather Javascript friendly way. I'm glad we don't support this kind of
 * weird numbering scheme in the kernel.
 *
 * (BIT-MAX - (unsigned)val + 1) * -1
 *
 * The astute observer, may think that this doesn't make sense for 8-bit numbers
 * (really it isn't necessary for them). However, when you get 16-bit numbers,
 * you do. Let's go back to our prior example and see how this will look:
 *
 * (0xffff - 0xff80 + 1) * -1
 * (0x007f + 1) * -1
 * (0x0080) * -1
 */
Buffer.prototype.readInt8 = function(offset, noAssert) {
  var buffer = this;
  var neg;

  if (!noAssert) {
    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset < buffer.length,
        'Trying to read beyond buffer length');
  }

  neg = buffer.parent[buffer.offset + offset] & 0x80;
  if (!neg) {
    return (buffer.parent[buffer.offset + offset]);
  }

  return ((0xff - buffer.parent[buffer.offset + offset] + 1) * -1);
};

function readInt16(buffer, offset, isBigEndian, noAssert) {
  var neg, val;

  if (!noAssert) {
    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 1 < buffer.length,
        'Trying to read beyond buffer length');
  }

  val = readUInt16(buffer, offset, isBigEndian, noAssert);
  neg = val & 0x8000;
  if (!neg) {
    return val;
  }

  return (0xffff - val + 1) * -1;
}

Buffer.prototype.readInt16LE = function(offset, noAssert) {
  return readInt16(this, offset, false, noAssert);
};

Buffer.prototype.readInt16BE = function(offset, noAssert) {
  return readInt16(this, offset, true, noAssert);
};

function readInt32(buffer, offset, isBigEndian, noAssert) {
  var neg, val;

  if (!noAssert) {
    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 3 < buffer.length,
        'Trying to read beyond buffer length');
  }

  val = readUInt32(buffer, offset, isBigEndian, noAssert);
  neg = val & 0x80000000;
  if (!neg) {
    return (val);
  }

  return (0xffffffff - val + 1) * -1;
}

Buffer.prototype.readInt32LE = function(offset, noAssert) {
  return readInt32(this, offset, false, noAssert);
};

Buffer.prototype.readInt32BE = function(offset, noAssert) {
  return readInt32(this, offset, true, noAssert);
};

function readFloat(buffer, offset, isBigEndian, noAssert) {
  if (!noAssert) {
    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset + 3 < buffer.length,
        'Trying to read beyond buffer length');
  }

  return require('./buffer_ieee754').readIEEE754(buffer, offset, isBigEndian,
      23, 4);
}

Buffer.prototype.readFloatLE = function(offset, noAssert) {
  return readFloat(this, offset, false, noAssert);
};

Buffer.prototype.readFloatBE = function(offset, noAssert) {
  return readFloat(this, offset, true, noAssert);
};

function readDouble(buffer, offset, isBigEndian, noAssert) {
  if (!noAssert) {
    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset + 7 < buffer.length,
        'Trying to read beyond buffer length');
  }

  return require('./buffer_ieee754').readIEEE754(buffer, offset, isBigEndian,
      52, 8);
}

Buffer.prototype.readDoubleLE = function(offset, noAssert) {
  return readDouble(this, offset, false, noAssert);
};

Buffer.prototype.readDoubleBE = function(offset, noAssert) {
  return readDouble(this, offset, true, noAssert);
};


/*
 * We have to make sure that the value is a valid integer. This means that it is
 * non-negative. It has no fractional component and that it does not exceed the
 * maximum allowed value.
 *
 *      value           The number to check for validity
 *
 *      max             The maximum value
 */
function verifuint(value, max) {
  assert.ok(typeof (value) == 'number',
      'cannot write a non-number as a number');

  assert.ok(value >= 0,
      'specified a negative value for writing an unsigned value');

  assert.ok(value <= max, 'value is larger than maximum value for type');

  assert.ok(Math.floor(value) === value, 'value has a fractional component');
}

Buffer.prototype.writeUInt8 = function(value, offset, noAssert) {
  var buffer = this;

  if (!noAssert) {
    assert.ok(value !== undefined && value !== null,
        'missing value');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset < buffer.length,
        'trying to write beyond buffer length');

    verifuint(value, 0xff);
  }

  buffer.parent[buffer.offset + offset] = value;
};

function writeUInt16(buffer, value, offset, isBigEndian, noAssert) {
  if (!noAssert) {
    assert.ok(value !== undefined && value !== null,
        'missing value');

    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 1 < buffer.length,
        'trying to write beyond buffer length');

    verifuint(value, 0xffff);
  }

  if (isBigEndian) {
    buffer.parent[buffer.offset + offset] = (value & 0xff00) >>> 8;
    buffer.parent[buffer.offset + offset + 1] = value & 0x00ff;
  } else {
    buffer.parent[buffer.offset + offset + 1] = (value & 0xff00) >>> 8;
    buffer.parent[buffer.offset + offset] = value & 0x00ff;
  }
}

Buffer.prototype.writeUInt16LE = function(value, offset, noAssert) {
  writeUInt16(this, value, offset, false, noAssert);
};

Buffer.prototype.writeUInt16BE = function(value, offset, noAssert) {
  writeUInt16(this, value, offset, true, noAssert);
};

function writeUInt32(buffer, value, offset, isBigEndian, noAssert) {
  if (!noAssert) {
    assert.ok(value !== undefined && value !== null,
        'missing value');

    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 3 < buffer.length,
        'trying to write beyond buffer length');

    verifuint(value, 0xffffffff);
  }

  if (isBigEndian) {
    buffer.parent[buffer.offset + offset] = (value >>> 24) & 0xff;
    buffer.parent[buffer.offset + offset + 1] = (value >>> 16) & 0xff;
    buffer.parent[buffer.offset + offset + 2] = (value >>> 8) & 0xff;
    buffer.parent[buffer.offset + offset + 3] = value & 0xff;
  } else {
    buffer.parent[buffer.offset + offset + 3] = (value >>> 24) & 0xff;
    buffer.parent[buffer.offset + offset + 2] = (value >>> 16) & 0xff;
    buffer.parent[buffer.offset + offset + 1] = (value >>> 8) & 0xff;
    buffer.parent[buffer.offset + offset] = value & 0xff;
  }
}

Buffer.prototype.writeUInt32LE = function(value, offset, noAssert) {
  writeUInt32(this, value, offset, false, noAssert);
};

Buffer.prototype.writeUInt32BE = function(value, offset, noAssert) {
  writeUInt32(this, value, offset, true, noAssert);
};


/*
 * We now move onto our friends in the signed number category. Unlike unsigned
 * numbers, we're going to have to worry a bit more about how we put values into
 * arrays. Since we are only worrying about signed 32-bit values, we're in
 * slightly better shape. Unfortunately, we really can't do our favorite binary
 * & in this system. It really seems to do the wrong thing. For example:
 *
 * > -32 & 0xff
 * 224
 *
 * What's happening above is really: 0xe0 & 0xff = 0xe0. However, the results of
 * this aren't treated as a signed number. Ultimately a bad thing.
 *
 * What we're going to want to do is basically create the unsigned equivalent of
 * our representation and pass that off to the wuint* functions. To do that
 * we're going to do the following:
 *
 *  - if the value is positive
 *      we can pass it directly off to the equivalent wuint
 *  - if the value is negative
 *      we do the following computation:
 *         mb + val + 1, where
 *         mb   is the maximum unsigned value in that byte size
 *         val  is the Javascript negative integer
 *
 *
 * As a concrete value, take -128. In signed 16 bits this would be 0xff80. If
 * you do out the computations:
 *
 * 0xffff - 128 + 1
 * 0xffff - 127
 * 0xff80
 *
 * You can then encode this value as the signed version. This is really rather
 * hacky, but it should work and get the job done which is our goal here.
 */

/*
 * A series of checks to make sure we actually have a signed 32-bit number
 */
function verifsint(value, max, min) {
  assert.ok(typeof (value) == 'number',
      'cannot write a non-number as a number');

  assert.ok(value <= max, 'value larger than maximum allowed value');

  assert.ok(value >= min, 'value smaller than minimum allowed value');

  assert.ok(Math.floor(value) === value, 'value has a fractional component');
}

function verifIEEE754(value, max, min) {
  assert.ok(typeof (value) == 'number',
      'cannot write a non-number as a number');

  assert.ok(value <= max, 'value larger than maximum allowed value');

  assert.ok(value >= min, 'value smaller than minimum allowed value');
}

Buffer.prototype.writeInt8 = function(value, offset, noAssert) {
  var buffer = this;

  if (!noAssert) {
    assert.ok(value !== undefined && value !== null,
        'missing value');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset < buffer.length,
        'Trying to write beyond buffer length');

    verifsint(value, 0x7f, -0x80);
  }

  if (value >= 0) {
    buffer.writeUInt8(value, offset, noAssert);
  } else {
    buffer.writeUInt8(0xff + value + 1, offset, noAssert);
  }
};

function writeInt16(buffer, value, offset, isBigEndian, noAssert) {
  if (!noAssert) {
    assert.ok(value !== undefined && value !== null,
        'missing value');

    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 1 < buffer.length,
        'Trying to write beyond buffer length');

    verifsint(value, 0x7fff, -0x8000);
  }

  if (value >= 0) {
    writeUInt16(buffer, value, offset, isBigEndian, noAssert);
  } else {
    writeUInt16(buffer, 0xffff + value + 1, offset, isBigEndian, noAssert);
  }
}

Buffer.prototype.writeInt16LE = function(value, offset, noAssert) {
  writeInt16(this, value, offset, false, noAssert);
};

Buffer.prototype.writeInt16BE = function(value, offset, noAssert) {
  writeInt16(this, value, offset, true, noAssert);
};

function writeInt32(buffer, value, offset, isBigEndian, noAssert) {
  if (!noAssert) {
    assert.ok(value !== undefined && value !== null,
        'missing value');

    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 3 < buffer.length,
        'Trying to write beyond buffer length');

    verifsint(value, 0x7fffffff, -0x80000000);
  }

  if (value >= 0) {
    writeUInt32(buffer, value, offset, isBigEndian, noAssert);
  } else {
    writeUInt32(buffer, 0xffffffff + value + 1, offset, isBigEndian, noAssert);
  }
}

Buffer.prototype.writeInt32LE = function(value, offset, noAssert) {
  writeInt32(this, value, offset, false, noAssert);
};

Buffer.prototype.writeInt32BE = function(value, offset, noAssert) {
  writeInt32(this, value, offset, true, noAssert);
};

function writeFloat(buffer, value, offset, isBigEndian, noAssert) {
  if (!noAssert) {
    assert.ok(value !== undefined && value !== null,
        'missing value');

    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 3 < buffer.length,
        'Trying to write beyond buffer length');

    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38);
  }

  require('./buffer_ieee754').writeIEEE754(buffer, value, offset, isBigEndian,
      23, 4);
}

Buffer.prototype.writeFloatLE = function(value, offset, noAssert) {
  writeFloat(this, value, offset, false, noAssert);
};

Buffer.prototype.writeFloatBE = function(value, offset, noAssert) {
  writeFloat(this, value, offset, true, noAssert);
};

function writeDouble(buffer, value, offset, isBigEndian, noAssert) {
  if (!noAssert) {
    assert.ok(value !== undefined && value !== null,
        'missing value');

    assert.ok(typeof (isBigEndian) === 'boolean',
        'missing or invalid endian');

    assert.ok(offset !== undefined && offset !== null,
        'missing offset');

    assert.ok(offset + 7 < buffer.length,
        'Trying to write beyond buffer length');

    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308);
  }

  require('./buffer_ieee754').writeIEEE754(buffer, value, offset, isBigEndian,
      52, 8);
}

Buffer.prototype.writeDoubleLE = function(value, offset, noAssert) {
  writeDouble(this, value, offset, false, noAssert);
};

Buffer.prototype.writeDoubleBE = function(value, offset, noAssert) {
  writeDouble(this, value, offset, true, noAssert);
};

SlowBuffer.prototype.readUInt8 = Buffer.prototype.readUInt8;
SlowBuffer.prototype.readUInt16LE = Buffer.prototype.readUInt16LE;
SlowBuffer.prototype.readUInt16BE = Buffer.prototype.readUInt16BE;
SlowBuffer.prototype.readUInt32LE = Buffer.prototype.readUInt32LE;
SlowBuffer.prototype.readUInt32BE = Buffer.prototype.readUInt32BE;
SlowBuffer.prototype.readInt8 = Buffer.prototype.readInt8;
SlowBuffer.prototype.readInt16LE = Buffer.prototype.readInt16LE;
SlowBuffer.prototype.readInt16BE = Buffer.prototype.readInt16BE;
SlowBuffer.prototype.readInt32LE = Buffer.prototype.readInt32LE;
SlowBuffer.prototype.readInt32BE = Buffer.prototype.readInt32BE;
SlowBuffer.prototype.readFloatLE = Buffer.prototype.readFloatLE;
SlowBuffer.prototype.readFloatBE = Buffer.prototype.readFloatBE;
SlowBuffer.prototype.readDoubleLE = Buffer.prototype.readDoubleLE;
SlowBuffer.prototype.readDoubleBE = Buffer.prototype.readDoubleBE;
SlowBuffer.prototype.writeUInt8 = Buffer.prototype.writeUInt8;
SlowBuffer.prototype.writeUInt16LE = Buffer.prototype.writeUInt16LE;
SlowBuffer.prototype.writeUInt16BE = Buffer.prototype.writeUInt16BE;
SlowBuffer.prototype.writeUInt32LE = Buffer.prototype.writeUInt32LE;
SlowBuffer.prototype.writeUInt32BE = Buffer.prototype.writeUInt32BE;
SlowBuffer.prototype.writeInt8 = Buffer.prototype.writeInt8;
SlowBuffer.prototype.writeInt16LE = Buffer.prototype.writeInt16LE;
SlowBuffer.prototype.writeInt16BE = Buffer.prototype.writeInt16BE;
SlowBuffer.prototype.writeInt32LE = Buffer.prototype.writeInt32LE;
SlowBuffer.prototype.writeInt32BE = Buffer.prototype.writeInt32BE;
SlowBuffer.prototype.writeFloatLE = Buffer.prototype.writeFloatLE;
SlowBuffer.prototype.writeFloatBE = Buffer.prototype.writeFloatBE;
SlowBuffer.prototype.writeDoubleLE = Buffer.prototype.writeDoubleLE;
SlowBuffer.prototype.writeDoubleBE = Buffer.prototype.writeDoubleBE;

});

require.define("/node_modules/buffer-browserify/node_modules/base64-js/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"lib/b64.js"}
});

require.define("/node_modules/buffer-browserify/node_modules/base64-js/lib/b64.js",function(require,module,exports,__dirname,__filename,process,global){(function (exports) {
	'use strict';

	var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

	function b64ToByteArray(b64) {
		var i, j, l, tmp, placeHolders, arr;
	
		if (b64.length % 4 > 0) {
			throw 'Invalid string. Length must be a multiple of 4';
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		placeHolders = b64.indexOf('=');
		placeHolders = placeHolders > 0 ? b64.length - placeHolders : 0;

		// base64 is 4/3 + up to two characters of the original data
		arr = [];//new Uint8Array(b64.length * 3 / 4 - placeHolders);

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length;

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (lookup.indexOf(b64[i]) << 18) | (lookup.indexOf(b64[i + 1]) << 12) | (lookup.indexOf(b64[i + 2]) << 6) | lookup.indexOf(b64[i + 3]);
			arr.push((tmp & 0xFF0000) >> 16);
			arr.push((tmp & 0xFF00) >> 8);
			arr.push(tmp & 0xFF);
		}

		if (placeHolders === 2) {
			tmp = (lookup.indexOf(b64[i]) << 2) | (lookup.indexOf(b64[i + 1]) >> 4);
			arr.push(tmp & 0xFF);
		} else if (placeHolders === 1) {
			tmp = (lookup.indexOf(b64[i]) << 10) | (lookup.indexOf(b64[i + 1]) << 4) | (lookup.indexOf(b64[i + 2]) >> 2);
			arr.push((tmp >> 8) & 0xFF);
			arr.push(tmp & 0xFF);
		}

		return arr;
	}

	function uint8ToBase64(uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length;

		function tripletToBase64 (num) {
			return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F];
		};

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
			output += tripletToBase64(temp);
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1];
				output += lookup[temp >> 2];
				output += lookup[(temp << 4) & 0x3F];
				output += '==';
				break;
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1]);
				output += lookup[temp >> 10];
				output += lookup[(temp >> 4) & 0x3F];
				output += lookup[(temp << 2) & 0x3F];
				output += '=';
				break;
		}

		return output;
	}

	module.exports.toByteArray = b64ToByteArray;
	module.exports.fromByteArray = uint8ToBase64;
}());

});

require.define("/node_modules/buffer-browserify/buffer_ieee754.js",function(require,module,exports,__dirname,__filename,process,global){exports.readIEEE754 = function(buffer, offset, isBE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isBE ? 0 : (nBytes - 1),
      d = isBE ? 1 : -1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.writeIEEE754 = function(buffer, value, offset, isBE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isBE ? (nBytes - 1) : 0,
      d = isBE ? -1 : 1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

});

require.define("/node_modules/ltx/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"./lib/index","browserify":"./lib/index-browserify.js"}
});

require.define("/node_modules/ltx/lib/index-browserify.js",function(require,module,exports,__dirname,__filename,process,global){/* Cause browserify to bundle SAX parsers: */
//require('./sax_easysax');
//require('./sax_saxjs');
require('./sax_ltx');

/* SHIM */
module.exports = require('./index');
});

require.define("/node_modules/ltx/lib/sax_ltx.js",function(require,module,exports,__dirname,__filename,process,global){var util = require('util');
var events = require('events');

const STATE_TEXT = 0,
    STATE_IGNORE_TAG = 1,
    STATE_TAG_NAME = 2,
    STATE_TAG = 3,
    STATE_ATTR_NAME = 4,
    STATE_ATTR_EQ = 5,
    STATE_ATTR_QUOT = 6,
    STATE_ATTR_VALUE = 7;

var RE_TAG_NAME = /^[^\s\/>]+$/,
    RE_ATTR_NAME = /^[^\s=]+$/;

var SaxLtx = module.exports = function SaxLtx() {
    events.EventEmitter.call(this);

    var state = STATE_TEXT, remainder;
    var tagName, attrs, endTag, selfClosing, attrQuote;
    var recordStart = 0;

    this.write = function(data) {
	if (typeof data !== 'string')
	    data = data.toString();
	var pos = 0;

	/* Anything from previous write()? */
	if (remainder) {
	    data = remainder + data;
	    pos += remainder.length;
	    delete remainder;
	}

	function endRecording() {
	    if (typeof recordStart === 'number') {
		var recorded = data.slice(recordStart, pos);
		recordStart = undefined;
		return recorded;
	    }
	}

	for(; pos < data.length; pos++) {
	    var c = data.charCodeAt(pos);
	    //console.log("state", state, "c", c, data[pos]);
	    switch(state) {
	    case STATE_TEXT:
		if (c === 60 /* < */) {
		    var text = endRecording();
		    if (text)
			this.emit('text', unescapeXml(text));
		    state = STATE_TAG_NAME;
		    recordStart = pos + 1;
		    attrs = {};
		}
		break;
	    case STATE_TAG_NAME:
		if (c === 47 /* / */ && recordStart === pos) {
		    recordStart = pos + 1;
		    endTag = true;
		} else if (c === 33 /* ! */ || c === 63 /* ? */) {
		    recordStart = undefined;
		    state = STATE_IGNORE_TAG;
		} else if (c <= 32 || c === 47 /* / */ || c === 62 /* > */) {
		    tagName = endRecording();
		    pos--;
		    state = STATE_TAG;
		}
		break;
	    case STATE_IGNORE_TAG:
		if (c === 62 /* > */) {
		    state = STATE_TEXT;
		}
		break;
	    case STATE_TAG:
		if (c === 62 /* > */) {
		    if (!endTag) {
			this.emit('startElement', tagName, attrs);
			if (selfClosing)
			    this.emit('endElement', tagName);
		    } else
			this.emit('endElement', tagName);
		    tagName = undefined;
		    attrs = undefined;
		    endTag = undefined;
		    selfClosing = undefined;
		    state = STATE_TEXT;
		    recordStart = pos + 1;
		} else if (c === 47 /* / */) {
		    selfClosing = true;
		} else if (c > 32) {
		    recordStart = pos;
		    state = STATE_ATTR_NAME;
		}
		break;
	    case STATE_ATTR_NAME:
		if (c <= 32 || c === 61 /* = */) {
		    attrName = endRecording();
		    pos--;
		    state = STATE_ATTR_EQ;
		}
		break;
	    case STATE_ATTR_EQ:
		if (c === 61 /* = */) {
		    state = STATE_ATTR_QUOT;
		}
		break;
	    case STATE_ATTR_QUOT:
		if (c === 34 /* " */ || c === 39 /* ' */) {
		    attrQuote = c;
		    state = STATE_ATTR_VALUE;
		    recordStart = pos + 1;
		}
		break;
	    case STATE_ATTR_VALUE:
		if (c === attrQuote) {
		    var value = unescapeXml(endRecording());
		    attrs[attrName] = value;
		    attrName = undefined;
		    state = STATE_TAG;
		}
		break;
	    }
	}

	if (typeof recordStart === 'number' &&
	    recordStart <= data.length) {

	    remainder = data.slice(recordStart);
	    recordStart = 0;
	}
    };

    /*var origEmit = this.emit;
    this.emit = function() {
	console.log('ltx', arguments);
	origEmit.apply(this, arguments);
    };*/
};
util.inherits(SaxLtx, events.EventEmitter);


SaxLtx.prototype.end = function(data) {
    if (data)
	this.write(data);

    /* Uh, yeah */
    this.write = function() {
    };
};

function unescapeXml(s) {
    return s.
        replace(/\&amp;/g, '&').
        replace(/\&lt;/g, '<').
        replace(/\&gt;/g, '>').
        replace(/\&quot;/g, '"').
        replace(/\&apos;/g, '\'');
}

});

require.define("/node_modules/ltx/lib/index.js",function(require,module,exports,__dirname,__filename,process,global){var element = require('./element');
var parse = require('./parse');

/**
 * The only (relevant) data structure
 */
exports.Element = element.Element;
/**
 * Helper
 */
exports.escapeXml = element.escapeXml;

/**
 * DOM parser interface
 */
exports.parse = parse.parse;
exports.Parser = parse.Parser;
/**
 * SAX parser interface
 */
exports.availableSaxParsers = parse.availableSaxParsers;
exports.bestSaxParser = parse.bestSaxParser;

});

require.define("/node_modules/ltx/lib/element.js",function(require,module,exports,__dirname,__filename,process,global){/**
 * This cheap replica of DOM/Builder puts me to shame :-)
 *
 * Attributes are in the element.attrs object. Children is a list of
 * either other Elements or Strings for text content.
 **/
function Element(name, attrs) {
    this.name = name;
    this.parent = null;
    this.attrs = attrs || {};
    this.children = [];
}

/*** Accessors ***/

/**
 * if (element.is('message', 'jabber:client')) ...
 **/
Element.prototype.is = function(name, xmlns) {
    return this.getName() == name &&
        (!xmlns || this.getNS() == xmlns);
};

/* without prefix */
Element.prototype.getName = function() {
    if (this.name.indexOf(":") >= 0)
        return this.name.substr(this.name.indexOf(":") + 1);
    else
        return this.name;
};

/**
 * retrieves the namespace of the current element, upwards recursively
 **/
Element.prototype.getNS = function() {
    if (this.name.indexOf(":") >= 0) {
        var prefix = this.name.substr(0, this.name.indexOf(":"));
        return this.findNS(prefix);
    } else {
        return this.findNS();
    }
};

/**
 * find the namespace to the given prefix, upwards recursively
 **/
Element.prototype.findNS = function(prefix) {
    if (!prefix) {
        /* default namespace */
        if (this.attrs.xmlns)
            return this.attrs.xmlns;
        else if (this.parent)
            return this.parent.findNS();
    } else {
        /* prefixed namespace */
        var attr = 'xmlns:' + prefix;
        if (this.attrs[attr])
            return this.attrs[attr];
        else if (this.parent)
            return this.parent.findNS(prefix);
    }
};

/**
 * xmlns can be null
 **/
Element.prototype.getChild = function(name, xmlns) {
    return this.getChildren(name, xmlns)[0];
};

/**
 * xmlns can be null
 **/
Element.prototype.getChildren = function(name, xmlns) {
    var result = [];
    for(var i = 0; i < this.children.length; i++) {
	      var child = this.children[i];
        if (child.getName &&
            child.getName() == name &&
            (!xmlns || child.getNS() == xmlns))
            result.push(child);
    }
    return result;
};

/**
 * xmlns and recursive can be null
 **/
Element.prototype.getChildByAttr = function(attr, val, xmlns, recursive) {
    return this.getChildrenByAttr(attr, val, xmlns, recursive)[0];
};

/**
 * xmlns and recursive can be null
 **/
Element.prototype.getChildrenByAttr = function(attr, val, xmlns, recursive) {
    var result = [];
    for(var i = 0; i < this.children.length; i++) {
	      var child = this.children[i];
        if (child.attrs &&
            child.attrs[attr] == val &&
            (!xmlns || child.getNS() == xmlns))
            result.push(child);
        if (recursive && child.getChildrenByAttr)
            result.push(child.getChildrenByAttr(attr, val, xmlns, true));
    }
    if (recursive) result = [].concat.apply([], result);
    return result;
};

Element.prototype.getText = function() {
    var text = "";
    for(var i = 0; i < this.children.length; i++) {
	var child = this.children[i];
        if (typeof child == 'string')
            text += child;
    }
    return text;
};

Element.prototype.getChildText = function(name, xmlns) {
    var child = this.getChild(name, xmlns);
    return child ? child.getText() : null;
};

/*** Builder ***/

/** returns uppermost parent */
Element.prototype.root = function() {
    if (this.parent)
        return this.parent.root();
    else
        return this;
};
Element.prototype.tree = Element.prototype.root;

/** just parent or itself */
Element.prototype.up = function() {
    if (this.parent)
        return this.parent;
    else
        return this;
};

/** create child node and return it */
Element.prototype.c = function(name, attrs) {
    return this.cnode(new Element(name, attrs));
};

Element.prototype.cnode = function(child) {
    this.children.push(child);
    child.parent = this;
    return child;
};

/** add text node and return element */
Element.prototype.t = function(text) {
    this.children.push(text);
    return this;
};

/*** Manipulation ***/

/**
 * Either:
 *   el.remove(childEl);
 *   el.remove('author', 'urn:...');
 */
Element.prototype.remove = function(el, xmlns) {
    var filter;
    if (typeof el === 'string') {
	/* 1st parameter is tag name */
	filter = function(child) {
	    return !(child.is &&
		     child.is(el, xmlns));
	};
    } else {
	/* 1st parameter is element */
	filter = function(child) {
	    return child !== el;
	};
    }

    this.children = this.children.filter(filter);

    return this;
};

/**
 * To use in case you want the same XML data for separate uses.
 * Please refrain from this practise unless you know what you are
 * doing. Building XML with ltx is easy!
 */
Element.prototype.clone = function() {
    var clone = new Element(this.name, {});
    for(var k in this.attrs) {
	if (this.attrs.hasOwnProperty(k))
	    clone.attrs[k] = this.attrs[k];
    }
    for(var i = 0; i < this.children.length; i++) {
	var child = this.children[i];
	clone.cnode(child.clone ? child.clone() : child);
    }
    return clone;
};

Element.prototype.text = function(val) {
    if(val && this.children.length == 1){
        this.children[0] = val;
        return this;
    }
    return this.getText();
};

Element.prototype.attr = function(attr, val) {
    if(val){
        if(!this.attrs){
          this.attrs = {};
        }
        this.attrs[attr] = val;
        return this;
    }
    return this.attrs[attr];
};

/*** Serialization ***/

Element.prototype.toString = function() {
    var s = "";
    this.write(function(c) {
        s += c;
    });
    return s;
};

Element.prototype.write = function(writer) {
    writer("<");
    writer(this.name);
    for(var k in this.attrs) {
        var v = this.attrs[k];
	if (v || v === '' || v === 0) {
	    writer(" ");
            writer(k);
            writer("=\"");
            if (typeof v != 'string')
		v = v.toString();
            writer(escapeXml(v));
            writer("\"");
	}
    }
    if (this.children.length == 0) {
        writer("/>");
    } else {
        writer(">");
	for(var i = 0; i < this.children.length; i++) {
	    var child = this.children[i];
	    /* Skip null/undefined */
	    if (child || child === 0) {
		if (child.write)
		    child.write(writer);
		else if (typeof child === 'string')
			writer(escapeXmlText(child));
		else if (child.toString)
			writer(escapeXmlText(child.toString()));
	    }
        }
        writer("</");
        writer(this.name);
        writer(">");
    }
};

function escapeXml(s) {
    return s.
        replace(/\&/g, '&amp;').
        replace(/</g, '&lt;').
        replace(/>/g, '&gt;').
        replace(/"/g, '&quot;').
        replace(/'/g, '&apos;');
}

function escapeXmlText(s) {
    return s.
        replace(/\&/g, '&amp;').
        replace(/</g, '&lt;').
        replace(/>/g, '&gt;');
}

exports.Element = Element;
exports.escapeXml = escapeXml;

});

require.define("/node_modules/ltx/lib/parse.js",function(require,module,exports,__dirname,__filename,process,global){var events = require('events');
var util = require('util');

exports.availableSaxParsers = [];
exports.bestSaxParser = null;
['./sax_expat.js', './sax_ltx.js', /*'./sax_easysax.js', './sax_node-xml.js',*/ './sax_saxjs.js'].forEach(function(modName) {
    var mod;
    try {
	mod = require(modName);
    } catch (e) {
	/* Silently missing libraries drop; for debug:
	console.error(e.stack || e);
	 */
    }
    if (mod) {
	exports.availableSaxParsers.push(mod);
	if (!exports.bestSaxParser)
	    exports.bestSaxParser = mod;
    }
});
var element = require('./element');

exports.Parser = function(saxParser) {
    events.EventEmitter.call(this);
    var that = this;

    var parserMod = saxParser || exports.bestSaxParser;
    if (!parserMod)
	throw new Error("No SAX parser available");
    this.parser = new parserMod();

    var el;
    this.parser.addListener('startElement', function(name, attrs) {
        var child = new element.Element(name, attrs);
        if (!el) {
            el = child;
        } else {
            el = el.cnode(child);
        }
    });
    this.parser.addListener('endElement', function(name) {
        if (!el) {
            /* Err */
        } else if (el && name == el.name) {
            if (el.parent)
                el = el.parent;
            else if (!that.tree) {
                that.tree = el;
                el = undefined;
            }
        }
    });
    this.parser.addListener('text', function(str) {
        if (el)
            el.t(str);
    });
    this.parser.addListener('error', function(e) {
	that.error = e;
	that.emit('error', e);
    });
};
util.inherits(exports.Parser, events.EventEmitter);

exports.Parser.prototype.write = function(data) {
    this.parser.write(data);
};

exports.Parser.prototype.end = function(data) {
    this.parser.end(data);

    if (!this.error) {
	if (this.tree)
	    this.emit('tree', this.tree);
	else
	    this.emit('error', new Error('Incomplete document'));
    }
};

exports.parse = function(data, saxParser) {
    var p = new exports.Parser(saxParser);
    var result = null, error = null;

    p.on('tree', function(tree) {
        result = tree;
    });
    p.on('error', function(e) {
        error = e;
    });

    p.write(data);
    p.end();

    if (error)
        throw error;
    else
        return result;
};

});

require.define("/lib/xmpp/stream_parser.js",function(require,module,exports,__dirname,__filename,process,global){var util = require('util');
var EventEmitter = require('events').EventEmitter;
var ltx = require('ltx');
var Stanza = require('./stanza').Stanza;

/**
 * Recognizes <stream:stream> and collects stanzas; used for ordinary
 * TCP streams and Websockets.
 *
 * API: write(data) & end(data)
 * Events: streamStart, stanza, end, error
 */
function StreamParser(maxStanzaSize) {
    EventEmitter.call(this);

    var self = this;
    this.parser = new ltx.bestSaxParser();

    /* Count traffic for entire life-time */
    this.bytesParsed = 0;
    this.maxStanzaSize = maxStanzaSize;
    /* Will be reset upon first stanza, but enforce maxStanzaSize until it is parsed */
    this.bytesParsedOnStanzaBegin = 0;

    this.parser.addListener('startElement', function(name, attrs) {
        // TODO: refuse anything but <stream:stream>
        if (!self.element && name == 'stream:stream') {
            self.emit('streamStart', attrs);
        } else {
	    var child;
            if (!self.element) {
                /* A new stanza */
		child = new Stanza(name, attrs);
                self.element = child;
		/* For maxStanzaSize enforcement */
                self.bytesParsedOnStanzaBegin = self.bytesParsed;
            } else {
                /* A child element of a stanza */
		child = new ltx.Element(name, attrs);
                self.element = self.element.cnode(child);
            }
        }
    });

    this.parser.addListener('endElement', function(name) {
        if (!self.element && name == 'stream:stream') {
            self.end();
        } else if (self.element && name == self.element.name) {
            if (self.element.parent)
                self.element = self.element.parent;
            else {
                /* Stanza complete */
                self.emit('stanza', self.element);
                delete self.element;
		/* maxStanzaSize doesn't apply until next startElement */
                delete self.bytesParsedOnStanzaBegin;
            }
        } else {
            self.error('xml-not-well-formed', 'XML parse error');
        }
    });
    
    this.parser.addListener('text', function(str) {
        if (self.element)
            self.element.t(str);
    });
    
    this.parser.addListener('entityDecl', function() {
	/* Entity declarations are forbidden in XMPP. We must abort to
	 * avoid a billion laughs.
	 */
	self.error('xml-not-well-formed', 'No entity declarations allowed');
	self.end();
    });

    this.parser.addListener('error', function(error) {
	self.emit('error', error);
    });
}
util.inherits(StreamParser, EventEmitter);
exports.StreamParser = StreamParser;

StreamParser.prototype.write = function(data) {
    /*if (/^<stream:stream [^>]+\/>$/.test(data)) {
	data = data.replace(/\/>$/, ">");
    }*/
    if (this.parser) {
	/* If a maxStanzaSize is configured, the current stanza must consist only of this many bytes */
        if (this.bytesParsedOnStanzaBegin && this.maxStanzaSize &&
            this.bytesParsed > this.bytesParsedOnStanzaBegin + this.maxStanzaSize) {

            this.error('policy-violation', 'Maximum stanza size exceeded');
            return;
        }
        this.bytesParsed += data.length;

        this.parser.write(data);
    }
};

StreamParser.prototype.end = function(data) {
    if (data) {
        this.write(data);
    }

    delete this.parser;
    this.emit('end');
};

StreamParser.prototype.error = function(condition, message) {
    var e = new Error(message);
    e.condition = condition;
    this.emit('error', e);
};

});

require.define("/lib/xmpp/stanza.js",function(require,module,exports,__dirname,__filename,process,global){var util = require('util');
var ltx = require('ltx');

function Stanza(name, attrs) {
    ltx.Element.call(this, name, attrs);
}
util.inherits(Stanza, ltx.Element);

/**
 * Common attribute getters/setters for all stanzas
 */

Stanza.prototype.__defineGetter__('from', function() {
    return this.attrs.from;
});
Stanza.prototype.__defineSetter__('from', function(from) {
    this.attrs.from = from;
});

Stanza.prototype.__defineGetter__('to', function() {
    return this.attrs.to;
});
Stanza.prototype.__defineSetter__('to', function(to) {
    this.attrs.to = to;
});

Stanza.prototype.__defineGetter__('id', function() {
    return this.attrs.id;
});
Stanza.prototype.__defineSetter__('id', function(id) {
    this.attrs.id = id;
});

Stanza.prototype.__defineGetter__('type', function() {
    return this.attrs.type;
});
Stanza.prototype.__defineSetter__('type', function(type) {
    this.attrs.type = type;
});


/**
 * Stanza kinds
 */

function Message(attrs) {
    Stanza.call(this, 'message', attrs);
}
util.inherits(Message, Stanza);

function Presence(attrs) {
    Stanza.call(this, 'presence', attrs);
}
util.inherits(Presence, Stanza);

function Iq(attrs) {
    Stanza.call(this, 'iq', attrs);
}
util.inherits(Iq, Stanza);

exports.Stanza = Stanza;
exports.Message = Message;
exports.Presence = Presence;
exports.Iq = Iq;

});

require.define("/lib/starttls.js",function(require,module,exports,__dirname,__filename,process,global){// Target API:
//
//  var s = require('net').createStream(25, 'smtp.example.com');
//  s.on('connect', function() {
//   require('starttls')(s, creds, false, function() {
//      if (!s.authorized) {
//        s.destroy();
//        return;
//      }
//
//      s.end("hello world\n");
//    });
//  });

var crypto = require('crypto');
var tls = require('tls');

module.exports = function starttls(socket, credentials, isServer, cb) {

  var pair = tls.createSecurePair(credentials, isServer, false, !isServer);

  var cleartext = pipe(pair, socket);

  pair.on('secure', function() {
    var ssl = pair._ssl || pair.ssl;
    var verifyError = ssl.verifyError();

    if (verifyError) {
      cleartext.authorized = false;
      cleartext.authorizationError = verifyError;
    } else {
      cleartext.authorized = true;
    }

    if (cb) cb();
  });

  cleartext._controlReleased = true;
  return cleartext;
};


function pipe(pair, socket) {
  pair.encrypted.pipe(socket);
  socket.pipe(pair.encrypted);

  pair.fd = socket.fd;
  var cleartext = pair.cleartext;
  cleartext.socket = socket;
  cleartext.encrypted = pair.encrypted;
  cleartext.authorized = false;

  function onerror(e) {
    if (cleartext._controlReleased) {
      cleartext.emit('error', e);
    }
  }

  function onclose() {
    socket.removeListener('error', onerror);
    socket.removeListener('close', onclose);
  }

  socket.on('error', onerror);
  socket.on('close', onclose);

  return cleartext;
}

});

require.define("crypto",function(require,module,exports,__dirname,__filename,process,global){module.exports = require("crypto-browserify")
});

require.define("/node_modules/crypto-browserify/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {}
});

require.define("/node_modules/crypto-browserify/index.js",function(require,module,exports,__dirname,__filename,process,global){var sha = require('./sha')
var rng = require('./rng')
var md5 = require('./md5')

var algorithms = {
  sha1: {
    hex: sha.hex_sha1,
    binary: sha.b64_sha1,
    ascii: sha.str_sha1
  },
  md5: {
    hex: md5.hex_md5,
    binary: md5.b64_md5,
    ascii: md5.any_md5
  }
}

function error () {
  var m = [].slice.call(arguments).join(' ')
  throw new Error([
    m,
    'we accept pull requests',
    'http://github.com/dominictarr/crypto-browserify'
    ].join('\n'))
}

exports.createHash = function (alg) {
  alg = alg || 'sha1'
  if(!algorithms[alg])
    error('algorithm:', alg, 'is not yet supported')
  var s = ''
  var _alg = algorithms[alg]
  return {
    update: function (data) {
      s += data
      return this
    },
    digest: function (enc) {
      enc = enc || 'binary'
      var fn
      if(!(fn = _alg[enc]))
        error('encoding:', enc , 'is not yet supported for algorithm', alg)
      var r = fn(s)
      s = null //not meant to use the hash after you've called digest.
      return r
    }
  }
}

exports.randomBytes = function(size, callback) {
  if (callback && callback.call) {
    try {
      callback.call(this, undefined, rng(size));
    } catch (err) { callback(err); }
  } else {
    return rng(size);
  }
}

// the least I can do is make error messages for the rest of the node.js/crypto api.
;['createCredentials'
, 'createHmac'
, 'createCypher'
, 'createCypheriv'
, 'createDecipher'
, 'createDecipheriv'
, 'createSign'
, 'createVerify'
, 'createDeffieHellman'
, 'pbkdf2'].forEach(function (name) {
  exports[name] = function () {
    error('sorry,', name, 'is not implemented yet')
  }
})

});

require.define("/node_modules/crypto-browserify/sha.js",function(require,module,exports,__dirname,__filename,process,global){/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

exports.hex_sha1 = hex_sha1;
exports.b64_sha1 = b64_sha1;
exports.str_sha1 = str_sha1;
exports.hex_hmac_sha1 = hex_hmac_sha1;
exports.b64_hmac_sha1 = b64_hmac_sha1;
exports.str_hmac_sha1 = str_hmac_sha1;

/*
 * Configurable variables. You may need to tweak these to be compatible with
 * the server-side, but the defaults work in most cases.
 */
var hexcase = 0;  /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad  = ""; /* base-64 pad character. "=" for strict RFC compliance   */
var chrsz   = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode      */

/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_sha1(s){return binb2hex(core_sha1(str2binb(s),s.length * chrsz));}
function b64_sha1(s){return binb2b64(core_sha1(str2binb(s),s.length * chrsz));}
function str_sha1(s){return binb2str(core_sha1(str2binb(s),s.length * chrsz));}
function hex_hmac_sha1(key, data){ return binb2hex(core_hmac_sha1(key, data));}
function b64_hmac_sha1(key, data){ return binb2b64(core_hmac_sha1(key, data));}
function str_hmac_sha1(key, data){ return binb2str(core_hmac_sha1(key, data));}

/*
 * Perform a simple self-test to see if the VM is working
 */
function sha1_vm_test()
{
  return hex_sha1("abc") == "a9993e364706816aba3e25717850c26c9cd0d89d";
}

/*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
function core_sha1(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << (24 - len % 32);
  x[((len + 64 >> 9) << 4) + 15] = len;

  var w = Array(80);
  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;
  var e = -1009589776;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    var olde = e;

    for(var j = 0; j < 80; j++)
    {
      if(j < 16) w[j] = x[i + j];
      else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
      var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
                       safe_add(safe_add(e, w[j]), sha1_kt(j)));
      e = d;
      d = c;
      c = rol(b, 30);
      b = a;
      a = t;
    }

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
    e = safe_add(e, olde);
  }
  return Array(a, b, c, d, e);

}

/*
 * Perform the appropriate triplet combination function for the current
 * iteration
 */
function sha1_ft(t, b, c, d)
{
  if(t < 20) return (b & c) | ((~b) & d);
  if(t < 40) return b ^ c ^ d;
  if(t < 60) return (b & c) | (b & d) | (c & d);
  return b ^ c ^ d;
}

/*
 * Determine the appropriate additive constant for the current iteration
 */
function sha1_kt(t)
{
  return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
         (t < 60) ? -1894007588 : -899497514;
}

/*
 * Calculate the HMAC-SHA1 of a key and some data
 */
function core_hmac_sha1(key, data)
{
  var bkey = str2binb(key);
  if(bkey.length > 16) bkey = core_sha1(bkey, key.length * chrsz);

  var ipad = Array(16), opad = Array(16);
  for(var i = 0; i < 16; i++)
  {
    ipad[i] = bkey[i] ^ 0x36363636;
    opad[i] = bkey[i] ^ 0x5C5C5C5C;
  }

  var hash = core_sha1(ipad.concat(str2binb(data)), 512 + data.length * chrsz);
  return core_sha1(opad.concat(hash), 512 + 160);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

/*
 * Convert an 8-bit or 16-bit string to an array of big-endian words
 * In 8-bit function, characters >255 have their hi-byte silently ignored.
 */
function str2binb(str)
{
  var bin = Array();
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < str.length * chrsz; i += chrsz)
    bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (32 - chrsz - i%32);
  return bin;
}

/*
 * Convert an array of big-endian words to a string
 */
function binb2str(bin)
{
  var str = "";
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < bin.length * 32; i += chrsz)
    str += String.fromCharCode((bin[i>>5] >>> (32 - chrsz - i%32)) & mask);
  return str;
}

/*
 * Convert an array of big-endian words to a hex string.
 */
function binb2hex(binarray)
{
  var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i++)
  {
    str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
           hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8  )) & 0xF);
  }
  return str;
}

/*
 * Convert an array of big-endian words to a base-64 string
 */
function binb2b64(binarray)
{
  var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i += 3)
  {
    var triplet = (((binarray[i   >> 2] >> 8 * (3 -  i   %4)) & 0xFF) << 16)
                | (((binarray[i+1 >> 2] >> 8 * (3 - (i+1)%4)) & 0xFF) << 8 )
                |  ((binarray[i+2 >> 2] >> 8 * (3 - (i+2)%4)) & 0xFF);
    for(var j = 0; j < 4; j++)
    {
      if(i * 8 + j * 6 > binarray.length * 32) str += b64pad;
      else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
    }
  }
  return str;
}


});

require.define("/node_modules/crypto-browserify/rng.js",function(require,module,exports,__dirname,__filename,process,global){// Original code adapted from Robert Kieffer.
// details at https://github.com/broofa/node-uuid
(function() {
  var _global = this;

  var mathRNG, whatwgRNG;

  // NOTE: Math.random() does not guarantee "cryptographic quality"
  mathRNG = function(size) {
    var bytes = new Array(size);
    var r;

    for (var i = 0, r; i < size; i++) {
      if ((i & 0x03) == 0) r = Math.random() * 0x100000000;
      bytes[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return bytes;
  }

  // currently only available in webkit-based browsers.
  if (_global.crypto && crypto.getRandomValues) {
    var _rnds = new Uint32Array(4);
    whatwgRNG = function(size) {
      var bytes = new Array(size);
      crypto.getRandomValues(_rnds);

      for (var c = 0 ; c < size; c++) {
        bytes[c] = _rnds[c >> 2] >>> ((c & 0x03) * 8) & 0xff;
      }
      return bytes;
    }
  }

  module.exports = whatwgRNG || mathRNG;

}())
});

require.define("/node_modules/crypto-browserify/md5.js",function(require,module,exports,__dirname,__filename,process,global){/*
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */

/*
 * Configurable variables. You may need to tweak these to be compatible with
 * the server-side, but the defaults work in most cases.
 */
var hexcase = 0;   /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad  = "";  /* base-64 pad character. "=" for strict RFC compliance   */

/*
 * These are the functions you'll usually want to call
 * They take string arguments and return either hex or base-64 encoded strings
 */
function hex_md5(s)    { return rstr2hex(rstr_md5(str2rstr_utf8(s))); }
function b64_md5(s)    { return rstr2b64(rstr_md5(str2rstr_utf8(s))); }
function any_md5(s, e) { return rstr2any(rstr_md5(str2rstr_utf8(s)), e); }
function hex_hmac_md5(k, d)
  { return rstr2hex(rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d))); }
function b64_hmac_md5(k, d)
  { return rstr2b64(rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d))); }
function any_hmac_md5(k, d, e)
  { return rstr2any(rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d)), e); }

/*
 * Perform a simple self-test to see if the VM is working
 */
function md5_vm_test()
{
  return hex_md5("abc").toLowerCase() == "900150983cd24fb0d6963f7d28e17f72";
}

/*
 * Calculate the MD5 of a raw string
 */
function rstr_md5(s)
{
  return binl2rstr(binl_md5(rstr2binl(s), s.length * 8));
}

/*
 * Calculate the HMAC-MD5, of a key and some data (raw strings)
 */
function rstr_hmac_md5(key, data)
{
  var bkey = rstr2binl(key);
  if(bkey.length > 16) bkey = binl_md5(bkey, key.length * 8);

  var ipad = Array(16), opad = Array(16);
  for(var i = 0; i < 16; i++)
  {
    ipad[i] = bkey[i] ^ 0x36363636;
    opad[i] = bkey[i] ^ 0x5C5C5C5C;
  }

  var hash = binl_md5(ipad.concat(rstr2binl(data)), 512 + data.length * 8);
  return binl2rstr(binl_md5(opad.concat(hash), 512 + 128));
}

/*
 * Convert a raw string to a hex string
 */
function rstr2hex(input)
{
  try { hexcase } catch(e) { hexcase=0; }
  var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
  var output = "";
  var x;
  for(var i = 0; i < input.length; i++)
  {
    x = input.charCodeAt(i);
    output += hex_tab.charAt((x >>> 4) & 0x0F)
           +  hex_tab.charAt( x        & 0x0F);
  }
  return output;
}

/*
 * Convert a raw string to a base-64 string
 */
function rstr2b64(input)
{
  try { b64pad } catch(e) { b64pad=''; }
  var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var output = "";
  var len = input.length;
  for(var i = 0; i < len; i += 3)
  {
    var triplet = (input.charCodeAt(i) << 16)
                | (i + 1 < len ? input.charCodeAt(i+1) << 8 : 0)
                | (i + 2 < len ? input.charCodeAt(i+2)      : 0);
    for(var j = 0; j < 4; j++)
    {
      if(i * 8 + j * 6 > input.length * 8) output += b64pad;
      else output += tab.charAt((triplet >>> 6*(3-j)) & 0x3F);
    }
  }
  return output;
}

/*
 * Convert a raw string to an arbitrary string encoding
 */
function rstr2any(input, encoding)
{
  var divisor = encoding.length;
  var i, j, q, x, quotient;

  /* Convert to an array of 16-bit big-endian values, forming the dividend */
  var dividend = Array(Math.ceil(input.length / 2));
  for(i = 0; i < dividend.length; i++)
  {
    dividend[i] = (input.charCodeAt(i * 2) << 8) | input.charCodeAt(i * 2 + 1);
  }

  /*
   * Repeatedly perform a long division. The binary array forms the dividend,
   * the length of the encoding is the divisor. Once computed, the quotient
   * forms the dividend for the next step. All remainders are stored for later
   * use.
   */
  var full_length = Math.ceil(input.length * 8 /
                                    (Math.log(encoding.length) / Math.log(2)));
  var remainders = Array(full_length);
  for(j = 0; j < full_length; j++)
  {
    quotient = Array();
    x = 0;
    for(i = 0; i < dividend.length; i++)
    {
      x = (x << 16) + dividend[i];
      q = Math.floor(x / divisor);
      x -= q * divisor;
      if(quotient.length > 0 || q > 0)
        quotient[quotient.length] = q;
    }
    remainders[j] = x;
    dividend = quotient;
  }

  /* Convert the remainders to the output string */
  var output = "";
  for(i = remainders.length - 1; i >= 0; i--)
    output += encoding.charAt(remainders[i]);

  return output;
}

/*
 * Encode a string as utf-8.
 * For efficiency, this assumes the input is valid utf-16.
 */
function str2rstr_utf8(input)
{
  var output = "";
  var i = -1;
  var x, y;

  while(++i < input.length)
  {
    /* Decode utf-16 surrogate pairs */
    x = input.charCodeAt(i);
    y = i + 1 < input.length ? input.charCodeAt(i + 1) : 0;
    if(0xD800 <= x && x <= 0xDBFF && 0xDC00 <= y && y <= 0xDFFF)
    {
      x = 0x10000 + ((x & 0x03FF) << 10) + (y & 0x03FF);
      i++;
    }

    /* Encode output as utf-8 */
    if(x <= 0x7F)
      output += String.fromCharCode(x);
    else if(x <= 0x7FF)
      output += String.fromCharCode(0xC0 | ((x >>> 6 ) & 0x1F),
                                    0x80 | ( x         & 0x3F));
    else if(x <= 0xFFFF)
      output += String.fromCharCode(0xE0 | ((x >>> 12) & 0x0F),
                                    0x80 | ((x >>> 6 ) & 0x3F),
                                    0x80 | ( x         & 0x3F));
    else if(x <= 0x1FFFFF)
      output += String.fromCharCode(0xF0 | ((x >>> 18) & 0x07),
                                    0x80 | ((x >>> 12) & 0x3F),
                                    0x80 | ((x >>> 6 ) & 0x3F),
                                    0x80 | ( x         & 0x3F));
  }
  return output;
}

/*
 * Encode a string as utf-16
 */
function str2rstr_utf16le(input)
{
  var output = "";
  for(var i = 0; i < input.length; i++)
    output += String.fromCharCode( input.charCodeAt(i)        & 0xFF,
                                  (input.charCodeAt(i) >>> 8) & 0xFF);
  return output;
}

function str2rstr_utf16be(input)
{
  var output = "";
  for(var i = 0; i < input.length; i++)
    output += String.fromCharCode((input.charCodeAt(i) >>> 8) & 0xFF,
                                   input.charCodeAt(i)        & 0xFF);
  return output;
}

/*
 * Convert a raw string to an array of little-endian words
 * Characters >255 have their high-byte silently ignored.
 */
function rstr2binl(input)
{
  var output = Array(input.length >> 2);
  for(var i = 0; i < output.length; i++)
    output[i] = 0;
  for(var i = 0; i < input.length * 8; i += 8)
    output[i>>5] |= (input.charCodeAt(i / 8) & 0xFF) << (i%32);
  return output;
}

/*
 * Convert an array of little-endian words to a string
 */
function binl2rstr(input)
{
  var output = "";
  for(var i = 0; i < input.length * 32; i += 8)
    output += String.fromCharCode((input[i>>5] >>> (i % 32)) & 0xFF);
  return output;
}

/*
 * Calculate the MD5 of an array of little-endian words, and a bit length.
 */
function binl_md5(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << ((len) % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;

    a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
    d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
    c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
    b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
    a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
    d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
    c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
    b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
    a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
    d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
    c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
    b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
    a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
    d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
    c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
    b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);

    a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
    d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
    c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
    b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
    a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
    d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
    c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
    b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
    a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
    d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
    c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
    b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
    a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
    d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
    c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
    b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);

    a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
    d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
    c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
    b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
    a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
    d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
    c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
    b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
    a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
    d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
    c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
    b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
    a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
    d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
    c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
    b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);

    a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
    d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
    c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
    b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
    a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
    d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
    c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
    b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
    a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
    d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
    c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
    b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
    a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
    d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
    c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
    b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
  }
  return Array(a, b, c, d);
}

/*
 * These functions implement the four basic operations the algorithm uses.
 */
function md5_cmn(q, a, b, x, s, t)
{
  return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s),b);
}
function md5_ff(a, b, c, d, x, s, t)
{
  return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function md5_gg(a, b, c, d, x, s, t)
{
  return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function md5_hh(a, b, c, d, x, s, t)
{
  return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5_ii(a, b, c, d, x, s, t)
{
  return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function bit_rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}


exports.hex_md5 = hex_md5;
exports.b64_md5 = b64_md5;
exports.any_md5 = any_md5;

});

require.define("tls",function(require,module,exports,__dirname,__filename,process,global){// todo

});

require.define("/lib/xmpp/client.js",function(require,module,exports,__dirname,__filename,process,global){var EventEmitter = require('events').EventEmitter;
var Session = require('./session').Session;
var Connection = require('./connection');
var JID = require('./jid').JID;
var ltx = require('ltx');
var sasl = require('./sasl');
var util = require('util');
try {
    var SRV = require('./srv');
} catch (e) { }

var NS_CLIENT = 'jabber:client';
var NS_REGISTER = 'jabber:iq:register';
var NS_XMPP_SASL = 'urn:ietf:params:xml:ns:xmpp-sasl';
var NS_XMPP_BIND = 'urn:ietf:params:xml:ns:xmpp-bind';
var NS_XMPP_SESSION = 'urn:ietf:params:xml:ns:xmpp-session';

var STATE_PREAUTH = 0,
    STATE_AUTH = 1,
    STATE_AUTHED = 2,
    STATE_BIND = 3,
    STATE_SESSION = 4,
    STATE_ONLINE = 5;
var IQID_SESSION = 'sess',
    IQID_BIND = 'bind';

/**
 * params object:
 *   jid: String (required)
 *   password: String (required)
 *   host: String (optional)
 *   port: Number (optional)
 *   reconnect: Boolean (optional)
 *   register: Boolean (option) - register account before authentication
 *   legacySSL: Boolean (optional) - connect to the legacy SSL port, requires at least the host to be specified
 *   credentials: Dictionary (optional) - TLS or SSL key and certificate credentials
 *
 * Examples:
 *   var cl = new xmpp.Client({
 *       jid: "me@example.com",
 *       password: "secret"
 *   });
 *   var aceboo = new xmpp.Client({
 *       jid: '-' + fbUID + '@chat.facebook.com',
 *       api_key: '54321', // api key of your facebook app
 *       access_token: 'abcdefg', // user access token
 *       host: 'chat.facebook.com'
 *   });
 *   var gtalk = new xmpp.Client({
 *       jid: 'me@gmail.com',
 *       oauth2_token: 'xxxx.xxxxxxxxxxx', // from OAuth2
 *       oauth2_auth: 'http://www.google.com/talk/protocol/auth',
 *       host: 'talk.google.com'
 *   });
 *
 * Example SASL EXTERNAL:
 * 
 * var myCredentials = { 
 *   // These are necessary only if using the client certificate authentication
 *   key: fs.readFileSync('key.pem'),
 *   cert: fs.readFileSync('cert.pem'),
 *   // passphrase: 'optional'
 * };
 * var cl = new xmppClient({jid: "me@example.com", credentials: myCredentials }); 
 
 */
function Client(opts) {
    var self = this;

    opts.xmlns = NS_CLIENT;
    self.state = STATE_PREAUTH;
    delete self.did_bind;
    delete self.did_session;

    Session.call(this, opts);

    if (opts.credentials) {
        this.preferredSaslMechanism = 'EXTERNAL';
        this.availableSaslMechanisms = [ sasl.External ];
    }

    this.state = STATE_PREAUTH;
    this.addListener('end', function() {
        self.state = STATE_PREAUTH;
        self.emit('offline');
    });
    this.on('close', function() {
        self.state = STATE_PREAUTH;
    });
}

util.inherits(Client, Session);
exports.Client = Client;

Client.prototype.onStanza = function(stanza) {
    /* Actually, we shouldn't wait for <stream:features/> if
       this.streamAttrs.version is missing, but who uses pre-XMPP-1.0
       these days anyway? */
    if (this.state != STATE_ONLINE &&
        stanza.is('features', Connection.NS_STREAM)) {
        this.streamFeatures = stanza;
        this.useFeatures();
    } else if (this.state == STATE_AUTH) {
        if (stanza.is('challenge', NS_XMPP_SASL)) {
            var challengeMsg = decode64(stanza.getText());
            var responseMsg = encode64(this.mech.challenge(challengeMsg));
            this.send(new ltx.Element('response',
                                      { xmlns: NS_XMPP_SASL
                                      }).t(responseMsg));
        } else if (stanza.is('success', NS_XMPP_SASL)) {
            this.mech = null;
            this.state = STATE_AUTHED;
	    if (this.connection.startParser)
		this.connection.startParser();
	    if (this.connection.startStream)
		this.connection.startStream();
        } else {
            this.emit('error', 'XMPP authentication failure');
        }
    } else if (this.state == STATE_BIND &&
               stanza.is('iq') &&
               stanza.attrs.id == IQID_BIND) {
        if (stanza.attrs.type == 'result') {
            this.state = STATE_AUTHED;
            this.did_bind = true;

            var bindEl = stanza.getChild('bind', NS_XMPP_BIND);
            if (bindEl && bindEl.getChild('jid')) {
                this.jid = new JID(bindEl.getChild('jid').getText());
            }

            /* no stream restart, but next feature */
            this.useFeatures();
        } else {
            this.emit('error', 'Cannot bind resource');
        }
    } else if (this.state == STATE_SESSION &&
               stanza.is('iq') &&
               stanza.attrs.id == IQID_SESSION) {
        if (stanza.attrs.type == 'result') {
            this.state = STATE_AUTHED;
            this.did_session = true;

            /* no stream restart, but next feature (most probably
               we'll go online next) */
            this.useFeatures();
        } else {
            this.emit('error', 'Cannot bind resource');
        }
    } else if (stanza.name == 'stream:error') {
        this.emit('error', stanza);
    } else if (this.state == STATE_ONLINE) {
        this.emit('stanza', stanza);
    }
};

/**
 * Either we just received <stream:features/>, or we just enabled a
 * feature and are looking for the next.
 */
Client.prototype.useFeatures = function() {
    if (this.state == STATE_PREAUTH &&
        this.register) {
	delete this.register;
	this.doRegister();
    } else if (this.state == STATE_PREAUTH &&
        this.streamFeatures.getChild('mechanisms', NS_XMPP_SASL)) {
        this.state = STATE_AUTH;
	var offeredMechs = this.streamFeatures.
            getChild('mechanisms', NS_XMPP_SASL).
            getChildren('mechanism', NS_XMPP_SASL).
            map(function(el) { return el.getText(); });
        this.mech = sasl.selectMechanism(
            offeredMechs,
            this.preferredSaslMechanism,
            this.availableSaslMechanisms);
        if (this.mech) {
            this.mech.authzid = this.jid.bare().toString();
            this.mech.authcid = this.jid.user;
            this.mech.password = this.password;
            this.mech.api_key = this.api_key;
            this.mech.access_token = this.access_token;
            this.mech.oauth2_token = this.oauth2_token;
            this.mech.oauth2_auth = this.oauth2_auth;
            this.mech.realm = this.jid.domain;  // anything?
            this.mech.digest_uri = "xmpp/" + this.jid.domain;
            var authMsg = encode64(this.mech.auth());
            var attrs = this.mech.authAttrs();
            attrs.xmlns = NS_XMPP_SASL;
            attrs.mechanism = this.mech.name;
            this.send(new ltx.Element('auth', attrs).
		      t(authMsg));
        } else {
            this.emit('error', 'No usable SASL mechanism');
        }
    } else if (this.state == STATE_AUTHED &&
               !this.did_bind &&
               this.streamFeatures.getChild('bind', NS_XMPP_BIND)) {
        this.state = STATE_BIND;
        var bindEl = new ltx.Element('iq',
                                     { type: 'set',
                                       id: IQID_BIND
                                     }).c('bind',
                                          { xmlns: NS_XMPP_BIND
                                          });
        if (this.jid.resource)
            bindEl.c('resource').t(this.jid.resource);
        this.send(bindEl);
    } else if (this.state == STATE_AUTHED &&
               !this.did_session &&
               this.streamFeatures.getChild('session', NS_XMPP_SESSION)) {
        this.state = STATE_SESSION;
        this.send(new ltx.Element('iq',
                                  { type: 'set',
                                    to: this.jid.domain,
                                    id: IQID_SESSION
                                  }).c('session',
                                       { xmlns: NS_XMPP_SESSION
                                       }));
    } else if (this.state == STATE_AUTHED) {
        /* Ok, we're authenticated and all features have been
           processed */
        this.state = STATE_ONLINE;
        this.emit('online');
    }
};

Client.prototype.doRegister = function() {
    var id = "register" + Math.ceil(Math.random() * 99999);
    var iq = new ltx.Element('iq', { type: 'set',
				     id: id,
				     to: this.jid.domain
				   }).
	c('query', { xmlns: NS_REGISTER }).
	c('username').t(this.jid.user).up().
	c('password').t(this.password);
    this.send(iq);

    var that = this;
    var onReply = function(reply) {
	if (reply.is('iq') && reply.attrs.id === id) {
	    that.removeListener('stanza', onReply);

	    if (reply.attrs.type === 'result') {
		/* Registration successful, proceed to auth */
		that.useFeatures();
	    } else {
		that.emit('error', new Error("Registration error"));
	    }
	}
    };
    this.on('stanza', onReply);
};

Client.prototype.registerSaslMechanism = function () {
    var args = arguments.length > 0 ? Array.prototype.slice.call(arguments) : [];
    this.availableSaslMechanisms = this.availableSaslMechanisms.concat(args);
};

var decode64, encode64, Buffer;
if (typeof btoa === 'function') {
    decode64 = function(encoded) {
	return atob(encoded);
    };
} else {
    Buffer = require('buffer').Buffer;
    decode64 = function(encoded) {
	return (new Buffer(encoded, 'base64')).toString('utf8');
    };
}
if (typeof atob === 'function') {
    encode64 = function(decoded) {
	return btoa(decoded);
    };
} else {
    Buffer = require('buffer').Buffer;
    encode64 = function(decoded) {
	return (new Buffer(decoded, 'utf8')).toString('base64');
    };
}

});

require.define("/lib/xmpp/session.js",function(require,module,exports,__dirname,__filename,process,global){var util = require('util');
var EventEmitter = require('events').EventEmitter;
var Connection = require('./connection');
var BOSH = require('./bosh');
var WebSockets = require('./websockets');
var JID = require('./jid').JID;
var tls = require('tls');
var crypto = require('crypto');
var SRV = require('./srv');

function Session(opts) {
    var self = this;
    EventEmitter.call(this);

    if (typeof opts.jid == 'string')
        this.jid = new JID(opts.jid);
    else
        this.jid = opts.jid;
    this.password = opts.password;
    this.preferredSaslMechanism = opts.preferredSaslMechanism;
    this.availableSaslMechanisms = [];
    this.api_key = opts.api_key;
    this.access_token = opts.access_token;
    this.oauth2_token = opts.oauth2_token;
    this.oauth2_auth = opts.oauth2_auth;
    this.register = opts.register;
    delete this.did_bind;
    delete this.did_session;

    if (opts.websocketsURL) {
	this.connection = new WebSockets.WSConnection(opts.websocketsURL);
	this.connection.on('connected', function() {
	    if (self.connection.startStream)
		self.connection.startStream();
	});
    } else if (opts.boshURL) {
	this.connection = new BOSH.BOSHConnection({
	    jid: this.jid,
	    boshURL: opts.boshURL
	});
    } else {
	this.connection = new Connection.Connection({
	    xmlns: { '': opts.xmlns },
	    streamAttrs: {
		version: "1.0",
		to: this.jid.domain
	    }
	});
	var connect = function() {
	    if (opts.host) {
    	    self.connection.on('connect', function() {
    	        if (self.connection.startStream)
    		        self.connection.startStream();
    	    });

	        if (opts.legacySSL) {
	            self.connection.allowTLS = false;
	            self.connection.socket = tls.connect(opts.port || 5223, opts.host, opts.credentials || {}, function() {
	                self.connection.setupStream();
	                self.connection.startParser();
            	    self.connection.emit('connect');
	            });
	        } else {
	            if (opts.credentials) {
	                self.connection.credentials = crypto.createCredentials(opts.credentials);
	            }
	            
        		self.connection.socket.connect(opts.port || 5222, opts.host);
    		}
	    } else if (!SRV) {
		    throw "Cannot load SRV";
	    } else {
	        if (opts.legacySSL) {
	            throw "LegacySSL mode does not support DNS lookups";
	        }

            if (opts.credentials) {
                self.connection.credentials = crypto.createCredentials(opts.credentials);
            }
	        
		    var attempt = SRV.connect(self.connection.socket,
		        ['_xmpp-client._tcp'], self.jid.domain, 5222);
		    attempt.addListener('connect', function() {
		    if (self.connection.startStream)
			    self.connection.startStream();
		});
		attempt.addListener('error', function(e) {
		    self.emit('error', e);
		});
	    }
	};
	if (opts.reconnect)
	    self.reconnect = connect;
	connect();
    }
    this.connection.addListener('stanza', this.onStanza.bind(this));
    this.connection.addListener('drain', this.emit.bind(this, 'drain'));

    this.connection.addListener('end', function() {
        self.emit('end');
    });
    this.connection.addListener('close', function() {
        self.emit('close');
    });
}

util.inherits(Session, EventEmitter);
exports.Session = Session;


Session.prototype.pause = function() {
    if (this.connection && this.connection.pause)
	this.connection.pause();
};

Session.prototype.resume = function() {
    if (this.connection && this.connection.resume)
	this.connection.resume();
};

Session.prototype.send = function(stanza) {
    if (this.connection)
	this.connection.send(stanza.root());
};

Session.prototype.end = function() {
    if (this.connection)
	this.connection.end();
};

Session.prototype.onStanza = function(stanza) {
};

});

require.define("/lib/xmpp/bosh.js",function(require,module,exports,__dirname,__filename,process,global){var EventEmitter = require('events').EventEmitter;
var util = require('util');
var request;
if (process.title === 'browser')
    request = require('browser-request');
else {
    var requestPath = 'request';
    request = require(requestPath);
}
var ltx = require('ltx');


function BOSHConnection(opts) {
    var that = this;
    EventEmitter.call(this);

    this.boshURL = opts.boshURL;
    this.jid = opts.jid;
    this.xmlnsAttrs = {
	xmlns: "http://jabber.org/protocol/httpbind",
	'xmlns:xmpp': "urn:xmpp:xbosh",
	'xmlns:stream': "http://etherx.jabber.org/streams"
    };
    if (opts.xmlns)
	for(var prefix in opts.xmlns)
	    if (prefix)
		this.xmlnsAttrs["xmlns:" + prefix] = opts.xmlns[prefix];
	    else
		this.xmlnsAttrs["xmlns"] = opts.xmlns[prefix];
    this.currentRequests = 0;
    this.queue = [];
    this.rid = Math.ceil(Math.random() * 9999999999);

    this.request({
	to: this.jid.domain,
	ver: "1.6",
	wait: "10",
	hold: "1",
	content: this.contentType
    }, [], function(err, bodyEl) {
	if (err) {
	    that.emit('error', err);
	} else if (bodyEl && bodyEl.attrs) {
	    that.sid = bodyEl.attrs.sid;
	    that.maxRequests = parseInt(bodyEl.attrs.requests, 10) || 2;
	    if (that.sid && that.maxRequests > 0) {
		that.emit('connect');
		that.processResponse(bodyEl);
		process.nextTick(that.mayRequest.bind(that));
	    } else
		that.emit('error', "Invalid parameters");
	}
    });
}
util.inherits(BOSHConnection, EventEmitter);
exports.BOSHConnection = BOSHConnection;

BOSHConnection.prototype.contentType = "text/xml; charset=utf-8";

BOSHConnection.prototype.send = function(stanza) {
    this.queue.push(stanza.root());
    process.nextTick(this.mayRequest.bind(this));
};

BOSHConnection.prototype.processResponse = function(bodyEl) {
    if (bodyEl && bodyEl.children) {
	for(var i = 0; i < bodyEl.children.length; i++) {
	    var child = bodyEl.children[i];
	    if (child.name && child.attrs && child.children)
		this.emit('stanza', child);
	}
    }
    if (bodyEl && bodyEl.attrs.type === 'terminate') {
	this.emit('error', new Error(bodyEl.attrs.condition || "Session terminated"));
	this.emit('close');
    }
};

BOSHConnection.prototype.mayRequest = function() {
    var that = this;
    var canRequest =
	/* Must have a session already */
	this.sid &&
	/* We can only receive when one request is in flight */
	(this.currentRequests === 0 ||
	 /* Is there something to send, and are we allowed? */
	 ((this.queue.length > 0 && this.currentRequests < this.maxRequests))
	);
    if (!canRequest)
	return;

    var stanzas = this.queue;
    this.queue = [];
    this.rid++;
    this.request({}, stanzas, function(err, bodyEl) {
	if (err) {
	    that.emit('error', err);
	    that.emit('close');
	    delete that.sid;
	} else {
	    if (bodyEl)
		that.processResponse(bodyEl);

	    process.nextTick(that.mayRequest.bind(that));
	}
    });
};

BOSHConnection.prototype.end = function(stanzas) {
    var that = this;

    stanzas = stanzas || [];
    if (typeof stanzas !== 'array')
	stanzas = [stanzas];

    stanzas = this.queue.concat(stanzas);
    this.queue = [];
    this.rid++;
    this.request({ type: 'terminate' }, stanzas, function(err, bodyEl) {
	if (bodyEl)
	    that.processResponse(bodyEl);

	that.emit('end');
	that.emit('close');
	delete that.sid;
    });
};

BOSHConnection.prototype.maxHTTPRetries = 5;

BOSHConnection.prototype.request = function(attrs, children, cb, retry) {
    var that = this;
    retry = retry || 0;

    attrs.rid = this.rid.toString();
    if (this.sid)
	attrs.sid = this.sid;

    for(var k in this.xmlnsAttrs)
	attrs[k] = this.xmlnsAttrs[k];
    var boshEl = new ltx.Element('body', attrs);
    for(var i = 0; i < children.length; i++)
	boshEl.cnode(children[i]);

    request({
	uri: this.boshURL,
	method: 'POST',
	headers: {
	    "Content-Type": this.contentType
	},
	body: boshEl.toString()
    }, function(err, res, body) {
	that.currentRequests--;

	if (err) {
	    if (retry < that.maxHTTPRetries)
		return request(attrs, children, cb, retry + 1);
	    else
		return cb(err);
	}
	if (res.statusCode < 200 || res.statusCode >= 400)
	    return cb(new Error("HTTP status " + res.statusCode));

	var bodyEl;
	try {
	    bodyEl = ltx.parse(body);
	} catch(e) {
	    return cb(e);
	}

	if (bodyEl && bodyEl.attrs.type === 'terminate')
	    cb(new Error(bodyEl.attrs.condition));
	else if (bodyEl)
	    cb(null, bodyEl);
	else
	    cb(new Error('no <body/>'));
    });
    this.currentRequests++;
};

});

require.define("/node_modules/browser-request/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"browserify":"./dist/ender/request.js"}
});

require.define("/node_modules/browser-request/dist/ender/request.js",function(require,module,exports,__dirname,__filename,process,global){// Browser Request
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var xmlhttprequest = require('./xmlhttprequest')
if(!xmlhttprequest || typeof xmlhttprequest !== 'object')
  throw new Error('Could not find ./xmlhttprequest')

var XHR = xmlhttprequest.XMLHttpRequest
if(!XHR)
  throw new Error('Bad xmlhttprequest.XMLHttpRequest')
if(! ('_object' in (new XHR)))
  throw new Error('This is not portable XMLHttpRequest')

module.exports = request
request.XMLHttpRequest = XHR

var DEFAULT_TIMEOUT = 3 * 60 * 1000 // 3 minutes
  , LOG = getLogger()

//
// request
//

function request(options, callback) {
  // The entry-point to the API: prep the options object and pass the real work to run_xhr.
  if(typeof callback !== 'function')
    throw new Error('Bad callback given: ' + callback)

  if(!options)
    throw new Error('No options given')

  var options_onResponse = options.onResponse; // Save this for later.

  if(typeof options === 'string')
    options = {'uri':options};
  else
    options = JSON.parse(JSON.stringify(options)); // Use a duplicate for mutating.

  options.onResponse = options_onResponse // And put it back.

  if(options.url) {
    options.uri = options.url;
    delete options.url;
  }

  if(!options.uri && options.uri !== "")
    throw new Error("options.uri is a required argument");

  if(typeof options.uri != "string")
    throw new Error("options.uri must be a string");

  var unsupported_options = ['proxy', '_redirectsFollowed', 'maxRedirects', 'followRedirect']
  for (var i = 0; i < unsupported_options.length; i++)
    if(options[ unsupported_options[i] ])
      throw new Error("options." + unsupported_options[i] + " is not supported")

  options.callback = callback
  options.method = options.method || 'GET';
  options.headers = options.headers || {};
  options.body    = options.body || null
  options.timeout = options.timeout || request.DEFAULT_TIMEOUT

  if(options.headers.host)
    throw new Error("Options.headers.host is not supported");

  if(options.json) {
    options.headers.accept = options.headers.accept || 'application/json'
    if(options.method !== 'GET')
      options.headers['content-type'] = 'application/json'

    if(typeof options.json !== 'boolean')
      options.body = JSON.stringify(options.json)
    else if(typeof options.body !== 'string')
      options.body = JSON.stringify(options.body)
  }

  // If onResponse is boolean true, call back immediately when the response is known,
  // not when the full request is complete.
  options.onResponse = options.onResponse || noop
  if(options.onResponse === true) {
    options.onResponse = callback
    options.callback = noop
  }

  // XXX Browsers do not like this.
  //if(options.body)
  //  options.headers['content-length'] = options.body.length;

  // HTTP basic authentication
  if(!options.headers.authorization && options.auth)
    options.headers.authorization = 'Basic ' + b64_enc(options.auth.username + ':' + options.auth.password);

  return run_xhr(options)
}

var req_seq = 0
function run_xhr(options) {
  var xhr = new XHR
    , timed_out = false
    , is_cors = is_crossDomain(options.uri)
    , supports_cors = ('withCredentials' in xhr._object)

  req_seq += 1
  xhr.seq_id = req_seq
  xhr.id = req_seq + ': ' + options.method + ' ' + options.uri
  xhr._id = xhr.id // I know I will type "_id" from habit all the time.

  if(is_cors && !supports_cors) {
    var cors_err = new Error('Browser does not support cross-origin request: ' + options.uri)
    cors_err.cors = 'unsupported'
    return options.callback(cors_err, xhr)
  }

  xhr.timeoutTimer = setTimeout(too_late, options.timeout)
  function too_late() {
    timed_out = true
    var er = new Error('ETIMEDOUT')
    er.code = 'ETIMEDOUT'
    er.duration = options.timeout

    LOG.error('Timeout', { 'id':xhr._id, 'milliseconds':options.timeout })
    return options.callback(er, xhr)
  }

  // Some states can be skipped over, so remember what is still incomplete.
  var did = {'response':false, 'loading':false, 'end':false}

  xhr.onreadystatechange = on_state_change
  xhr.open(options.method, options.uri, true) // asynchronous
  if(is_cors)
    xhr._object.withCredentials = !! options.withCredentials
  xhr.send(options.body)
  return xhr

  function on_state_change(event) {
    if(timed_out)
      return LOG.debug('Ignoring timed out state change', {'state':xhr.readyState, 'id':xhr.id})

    LOG.debug('State change', {'state':xhr.readyState, 'id':xhr.id, 'timed_out':timed_out})

    if(xhr.readyState === XHR.OPENED) {
      LOG.debug('Request started', {'id':xhr.id})
      for (var key in options.headers)
        xhr.setRequestHeader(key, options.headers[key])
    }

    else if(xhr.readyState === XHR.HEADERS_RECEIVED)
      on_response()

    else if(xhr.readyState === XHR.LOADING) {
      on_response()
      on_loading()
    }

    else if(xhr.readyState === XHR.DONE) {
      on_response()
      on_loading()
      on_end()
    }
  }

  function on_response() {
    if(did.response)
      return

    did.response = true
    LOG.debug('Got response', {'id':xhr.id, 'status':xhr.status})
    clearTimeout(xhr.timeoutTimer)
    xhr.statusCode = xhr.status // Node request compatibility

    // Detect failed CORS requests.
    if(is_cors && xhr.statusCode == 0) {
      var cors_err = new Error('CORS request rejected: ' + options.uri)
      cors_err.cors = 'rejected'

      // Do not process this request further.
      did.loading = true
      did.end = true

      return options.callback(cors_err, xhr)
    }

    options.onResponse(null, xhr)
  }

  function on_loading() {
    if(did.loading)
      return

    did.loading = true
    LOG.debug('Response body loading', {'id':xhr.id})
    // TODO: Maybe simulate "data" events by watching xhr.responseText
  }

  function on_end() {
    if(did.end)
      return

    did.end = true
    LOG.debug('Request done', {'id':xhr.id})

    xhr.body = xhr.responseText
    if(options.json) {
      try        { xhr.body = JSON.parse(xhr.responseText) }
      catch (er) { return options.callback(er, xhr)        }
    }

    options.callback(null, xhr, xhr.body)
  }

} // request

request.withCredentials = false;
request.DEFAULT_TIMEOUT = DEFAULT_TIMEOUT;

//
// HTTP method shortcuts
//

var shortcuts = [ 'get', 'put', 'post', 'head' ];
shortcuts.forEach(function(shortcut) {
  var method = shortcut.toUpperCase();
  var func   = shortcut.toLowerCase();

  request[func] = function(opts) {
    if(typeof opts === 'string')
      opts = {'method':method, 'uri':opts};
    else {
      opts = JSON.parse(JSON.stringify(opts));
      opts.method = method;
    }

    var args = [opts].concat(Array.prototype.slice.apply(arguments, [1]));
    return request.apply(this, args);
  }
})

//
// CouchDB shortcut
//

request.couch = function(options, callback) {
  if(typeof options === 'string')
    options = {'uri':options}

  // Just use the request API to do JSON.
  options.json = true
  if(options.body)
    options.json = options.body
  delete options.body

  callback = callback || noop

  var xhr = request(options, couch_handler)
  return xhr

  function couch_handler(er, resp, body) {
    if(er)
      return callback(er, resp, body)

    if((resp.statusCode < 200 || resp.statusCode > 299) && body.error) {
      // The body is a Couch JSON object indicating the error.
      er = new Error('CouchDB error: ' + (body.error.reason || body.error.error))
      for (var key in body)
        er[key] = body[key]
      return callback(er, resp, body);
    }

    return callback(er, resp, body);
  }
}

//
// Utility
//

function noop() {}

function getLogger() {
  var logger = {}
    , levels = ['trace', 'debug', 'info', 'warn', 'error']
    , level, i

  for(i = 0; i < levels.length; i++) {
    level = levels[i]

    logger[level] = noop
    if(typeof console !== 'undefined' && console && console[level])
      logger[level] = formatted(console, level)
  }

  return logger
}

function formatted(obj, method) {
  return formatted_logger

  function formatted_logger(str, context) {
    if(typeof context === 'object')
      str += ' ' + JSON.stringify(context)

    return obj[method].call(obj, str)
  }
}

// Return whether a URL is a cross-domain request.
function is_crossDomain(url) {
  var rurl = /^([\w\+\.\-]+:)(?:\/\/([^\/?#:]*)(?::(\d+))?)?/

  // jQuery #8138, IE may throw an exception when accessing
  // a field from window.location if document.domain has been set
  var ajaxLocation
  try { ajaxLocation = location.href }
  catch (e) {
    // Use the href attribute of an A element since IE will modify it given document.location
    ajaxLocation = document.createElement( "a" );
    ajaxLocation.href = "";
    ajaxLocation = ajaxLocation.href;
  }

  var ajaxLocParts = rurl.exec(ajaxLocation.toLowerCase()) || []
    , parts = rurl.exec(url.toLowerCase() )

  var result = !!(
    parts &&
    (  parts[1] != ajaxLocParts[1]
    || parts[2] != ajaxLocParts[2]
    || (parts[3] || (parts[1] === "http:" ? 80 : 443)) != (ajaxLocParts[3] || (ajaxLocParts[1] === "http:" ? 80 : 443))
    )
  )

  //console.debug('is_crossDomain('+url+') -> ' + result)
  return result
}

// MIT License from http://phpjs.org/functions/base64_encode:358
function b64_enc (data) {
    // Encodes string using MIME base64 algorithm
    var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var o1, o2, o3, h1, h2, h3, h4, bits, i = 0, ac = 0, enc="", tmp_arr = [];

    if (!data) {
        return data;
    }

    // assume utf8 data
    // data = this.utf8_encode(data+'');

    do { // pack three octets into four hexets
        o1 = data.charCodeAt(i++);
        o2 = data.charCodeAt(i++);
        o3 = data.charCodeAt(i++);

        bits = o1<<16 | o2<<8 | o3;

        h1 = bits>>18 & 0x3f;
        h2 = bits>>12 & 0x3f;
        h3 = bits>>6 & 0x3f;
        h4 = bits & 0x3f;

        // use hexets to index into b64, and append result to encoded string
        tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
    } while (i < data.length);

    enc = tmp_arr.join('');

    switch (data.length % 3) {
        case 1:
            enc = enc.slice(0, -2) + '==';
        break;
        case 2:
            enc = enc.slice(0, -1) + '=';
        break;
    }

    return enc;
}

});

require.define("/node_modules/browser-request/dist/ender/xmlhttprequest.js",function(require,module,exports,__dirname,__filename,process,global){

!function(window) {
  if(typeof exports === 'undefined')
    throw new Error('Cannot find global "exports" object. Is this really CommonJS?')
  if(typeof module === 'undefined')
    throw new Error('Cannot find global "module" object. Is this really CommonJS?')
  if(!module.exports)
    throw new Error('Cannot find global "module.exports" object. Is this really CommonJS?')

  // Define globals to simulate a browser environment.
  var unsafeKeys = {"locationbar":1, "menubar":1, "personalbar":1, "scrollbars":1, "statusbar":1, "toolbar":1, "localStorage":1};
window = window || {}

  var document = window.document || {}
  if(!window.document)
    window.document = document

  var navigator = window.navigator || {}
  if(!window.navigator)
    window.navigator = navigator

  if(!navigator.userAgent)
    navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_2) AppleWebKit/534.51.22 (KHTML, like Gecko) Version/5.1.1 Safari/534.51.22';

  // Remember the old values in window. If the inner code changes anything, export that as a module and restore the old window value.
  var win = {}
    , key

  for (key in window)
    if(window.hasOwnProperty(key) && !unsafeKeys[key])
      win[key] = window[key]

  run_code()

  for (key in window)
    if(window.hasOwnProperty(key) && !unsafeKeys[key])
      if(window[key] !== win[key]) {
        exports[key] = window[key]
        window[key] = win[key]
      }

  function run_code() {
    // Begin browser file: XMLHttpRequest.js
/**
* XMLHttpRequest.js Copyright (C) 2011 Sergey Ilinsky (http://www.ilinsky.com)
*
* This work is free software; you can redistribute it and/or modify
* it under the terms of the GNU Lesser General Public License as published by
* the Free Software Foundation; either version 2.1 of the License, or
* (at your option) any later version.
*
* This work is distributed in the hope that it will be useful,
* but without any warranty; without even the implied warranty of
* merchantability or fitness for a particular purpose. See the
* GNU Lesser General Public License for more details.
*
* You should have received a copy of the GNU Lesser General Public License
* along with this library; if not, write to the Free Software Foundation, Inc.,
* 59 Temple Place, Suite 330, Boston, MA 02111-1307 USA
*/

(function () {

	// Save reference to earlier defined object implementation (if any)
	var oXMLHttpRequest = window.XMLHttpRequest;

	// Define on browser type
	var bGecko  = !!window.controllers;
	var bIE     = false && !window.opera;
	var bIE7    = bIE && window.navigator.userAgent.match(/MSIE 7.0/);

	// Enables "XMLHttpRequest()" call next to "new XMLHttpReques()"
	function fXMLHttpRequest() {
		this._object  = oXMLHttpRequest && !bIE7 ? new oXMLHttpRequest : new window.ActiveXObject("Microsoft.XMLHTTP");
		this._listeners = [];
	}

	// Constructor
	function cXMLHttpRequest() {
		return new fXMLHttpRequest;
	}
	cXMLHttpRequest.prototype = fXMLHttpRequest.prototype;

	// BUGFIX: Firefox with Firebug installed would break pages if not executed
	if (bGecko && oXMLHttpRequest.wrapped) {
		cXMLHttpRequest.wrapped = oXMLHttpRequest.wrapped;
	}

	// Constants
	cXMLHttpRequest.UNSENT            = 0;
	cXMLHttpRequest.OPENED            = 1;
	cXMLHttpRequest.HEADERS_RECEIVED  = 2;
	cXMLHttpRequest.LOADING           = 3;
	cXMLHttpRequest.DONE              = 4;

	// Public Properties
	cXMLHttpRequest.prototype.readyState    = cXMLHttpRequest.UNSENT;
	cXMLHttpRequest.prototype.responseText  = '';
	cXMLHttpRequest.prototype.responseXML   = null;
	cXMLHttpRequest.prototype.status        = 0;
	cXMLHttpRequest.prototype.statusText    = '';

	// Priority proposal
	cXMLHttpRequest.prototype.priority    = "NORMAL";

	// Instance-level Events Handlers
	cXMLHttpRequest.prototype.onreadystatechange  = null;

	// Class-level Events Handlers
	cXMLHttpRequest.onreadystatechange  = null;
	cXMLHttpRequest.onopen              = null;
	cXMLHttpRequest.onsend              = null;
	cXMLHttpRequest.onabort             = null;

	// Public Methods
	cXMLHttpRequest.prototype.open  = function(sMethod, sUrl, bAsync, sUser, sPassword) {
		// Delete headers, required when object is reused
		delete this._headers;

		// When bAsync parameter value is omitted, use true as default
		if (arguments.length < 3) {
			bAsync  = true;
		}

		// Save async parameter for fixing Gecko bug with missing readystatechange in synchronous requests
		this._async   = bAsync;

		// Set the onreadystatechange handler
		var oRequest  = this;
		var nState    = this.readyState;
		var fOnUnload = null;

		// BUGFIX: IE - memory leak on page unload (inter-page leak)
		if (bIE && bAsync) {
			fOnUnload = function() {
				if (nState != cXMLHttpRequest.DONE) {
					fCleanTransport(oRequest);
					// Safe to abort here since onreadystatechange handler removed
					oRequest.abort();
				}
			};
			window.attachEvent("onunload", fOnUnload);
		}

		// Add method sniffer
		if (cXMLHttpRequest.onopen) {
			cXMLHttpRequest.onopen.apply(this, arguments);
		}

		if (arguments.length > 4) {
			this._object.open(sMethod, sUrl, bAsync, sUser, sPassword);
		} else if (arguments.length > 3) {
			this._object.open(sMethod, sUrl, bAsync, sUser);
		} else {
			this._object.open(sMethod, sUrl, bAsync);
		}

		this.readyState = cXMLHttpRequest.OPENED;
		fReadyStateChange(this);

		this._object.onreadystatechange = function() {
			if (bGecko && !bAsync) {
				return;
			}

			// Synchronize state
			oRequest.readyState   = oRequest._object.readyState;
			fSynchronizeValues(oRequest);

			// BUGFIX: Firefox fires unnecessary DONE when aborting
			if (oRequest._aborted) {
				// Reset readyState to UNSENT
				oRequest.readyState = cXMLHttpRequest.UNSENT;

				// Return now
				return;
			}

			if (oRequest.readyState == cXMLHttpRequest.DONE) {
				// Free up queue
				delete oRequest._data;

				// Uncomment these lines for bAsync
				/**
				 * if (bAsync) {
				 * 	fQueue_remove(oRequest);
				 * }
				 */

				fCleanTransport(oRequest);

				// Uncomment this block if you need a fix for IE cache
				/**
				 * // BUGFIX: IE - cache issue
				 * if (!oRequest._object.getResponseHeader("Date")) {
				 * 	// Save object to cache
				 * 	oRequest._cached  = oRequest._object;
				 *
				 * 	// Instantiate a new transport object
				 * 	cXMLHttpRequest.call(oRequest);
				 *
				 * 	// Re-send request
				 * 	if (sUser) {
				 * 		if (sPassword) {
				 * 			oRequest._object.open(sMethod, sUrl, bAsync, sUser, sPassword);
				 * 		} else {
				 * 			oRequest._object.open(sMethod, sUrl, bAsync);
				 * 		}
				 *
				 * 		oRequest._object.setRequestHeader("If-Modified-Since", oRequest._cached.getResponseHeader("Last-Modified") || new window.Date(0));
				 * 		// Copy headers set
				 * 		if (oRequest._headers) {
				 * 			for (var sHeader in oRequest._headers) {
				 * 				// Some frameworks prototype objects with functions
				 * 				if (typeof oRequest._headers[sHeader] == "string") {
				 * 					oRequest._object.setRequestHeader(sHeader, oRequest._headers[sHeader]);
				 * 				}
				 * 			}
				 * 		}
				 * 		oRequest._object.onreadystatechange = function() {
				 * 			// Synchronize state
				 * 			oRequest.readyState   = oRequest._object.readyState;
				 *
				 * 			if (oRequest._aborted) {
				 * 				//
				 * 				oRequest.readyState = cXMLHttpRequest.UNSENT;
				 *
				 * 				// Return
				 * 				return;
				 * 			}
				 *
				 * 			if (oRequest.readyState == cXMLHttpRequest.DONE) {
				 * 				// Clean Object
				 * 				fCleanTransport(oRequest);
				 *
				 * 				// get cached request
				 * 				if (oRequest.status == 304) {
				 * 					oRequest._object  = oRequest._cached;
				 * 				}
				 *
				 * 				//
				 * 				delete oRequest._cached;
				 *
				 * 				//
				 * 				fSynchronizeValues(oRequest);
				 *
				 * 				//
				 * 				fReadyStateChange(oRequest);
				 *
				 * 				// BUGFIX: IE - memory leak in interrupted
				 * 				if (bIE && bAsync) {
				 * 					window.detachEvent("onunload", fOnUnload);
				 * 				}
				 *
				 * 			}
				 * 		};
				 * 		oRequest._object.send(null);
				 *
				 * 		// Return now - wait until re-sent request is finished
				 * 		return;
				 * 	};
				 */

				// BUGFIX: IE - memory leak in interrupted
				if (bIE && bAsync) {
					window.detachEvent("onunload", fOnUnload);
				}

				// BUGFIX: Some browsers (Internet Explorer, Gecko) fire OPEN readystate twice
				if (nState != oRequest.readyState) {
					fReadyStateChange(oRequest);
				}

				nState  = oRequest.readyState;
			}
		};
	};

	cXMLHttpRequest.prototype.send = function(vData) {
		// Add method sniffer
		if (cXMLHttpRequest.onsend) {
			cXMLHttpRequest.onsend.apply(this, arguments);
		}

		if (!arguments.length) {
			vData = null;
		}

		// BUGFIX: Safari - fails sending documents created/modified dynamically, so an explicit serialization required
		// BUGFIX: IE - rewrites any custom mime-type to "text/xml" in case an XMLNode is sent
		// BUGFIX: Gecko - fails sending Element (this is up to the implementation either to standard)
		if (vData && vData.nodeType) {
			vData = window.XMLSerializer ? new window.XMLSerializer().serializeToString(vData) : vData.xml;
			if (!this._headers["Content-Type"]) {
				this._object.setRequestHeader("Content-Type", "application/xml");
			}
		}

		this._data = vData;

		/**
		 * // Add to queue
		 * if (this._async) {
		 * 	fQueue_add(this);
		 * } else { */
		fXMLHttpRequest_send(this);
		 /**
		 * }
		 */
	};

	cXMLHttpRequest.prototype.abort = function() {
		// Add method sniffer
		if (cXMLHttpRequest.onabort) {
			cXMLHttpRequest.onabort.apply(this, arguments);
		}

		// BUGFIX: Gecko - unnecessary DONE when aborting
		if (this.readyState > cXMLHttpRequest.UNSENT) {
			this._aborted = true;
		}

		this._object.abort();

		// BUGFIX: IE - memory leak
		fCleanTransport(this);

		this.readyState = cXMLHttpRequest.UNSENT;

		delete this._data;

		/* if (this._async) {
	 	* 	fQueue_remove(this);
	 	* }
	 	*/
	};

	cXMLHttpRequest.prototype.getAllResponseHeaders = function() {
		return this._object.getAllResponseHeaders();
	};

	cXMLHttpRequest.prototype.getResponseHeader = function(sName) {
		return this._object.getResponseHeader(sName);
	};

	cXMLHttpRequest.prototype.setRequestHeader  = function(sName, sValue) {
		// BUGFIX: IE - cache issue
		if (!this._headers) {
			this._headers = {};
		}

		this._headers[sName]  = sValue;

		return this._object.setRequestHeader(sName, sValue);
	};

	// EventTarget interface implementation
	cXMLHttpRequest.prototype.addEventListener  = function(sName, fHandler, bUseCapture) {
		for (var nIndex = 0, oListener; oListener = this._listeners[nIndex]; nIndex++) {
			if (oListener[0] == sName && oListener[1] == fHandler && oListener[2] == bUseCapture) {
				return;
			}
		}

		// Add listener
		this._listeners.push([sName, fHandler, bUseCapture]);
	};

	cXMLHttpRequest.prototype.removeEventListener = function(sName, fHandler, bUseCapture) {
		for (var nIndex = 0, oListener; oListener = this._listeners[nIndex]; nIndex++) {
			if (oListener[0] == sName && oListener[1] == fHandler && oListener[2] == bUseCapture) {
				break;
			}
		}

		// Remove listener
		if (oListener) {
			this._listeners.splice(nIndex, 1);
		}
	};

	cXMLHttpRequest.prototype.dispatchEvent = function(oEvent) {
		var oEventPseudo  = {
			'type':             oEvent.type,
			'target':           this,
			'currentTarget':    this,
			'eventPhase':       2,
			'bubbles':          oEvent.bubbles,
			'cancelable':       oEvent.cancelable,
			'timeStamp':        oEvent.timeStamp,
			'stopPropagation':  function() {},  // There is no flow
			'preventDefault':   function() {},  // There is no default action
			'initEvent':        function() {}   // Original event object should be initialized
		};

		// Execute onreadystatechange
		if (oEventPseudo.type == "readystatechange" && this.onreadystatechange) {
			(this.onreadystatechange.handleEvent || this.onreadystatechange).apply(this, [oEventPseudo]);
		}


		// Execute listeners
		for (var nIndex = 0, oListener; oListener = this._listeners[nIndex]; nIndex++) {
			if (oListener[0] == oEventPseudo.type && !oListener[2]) {
				(oListener[1].handleEvent || oListener[1]).apply(this, [oEventPseudo]);
			}
		}

	};

	//
	cXMLHttpRequest.prototype.toString  = function() {
		return '[' + "object" + ' ' + "XMLHttpRequest" + ']';
	};

	cXMLHttpRequest.toString  = function() {
		return '[' + "XMLHttpRequest" + ']';
	};

	/**
	 * // Queue manager
	 * var oQueuePending = {"CRITICAL":[],"HIGH":[],"NORMAL":[],"LOW":[],"LOWEST":[]},
	 * aQueueRunning = [];
	 * function fQueue_add(oRequest) {
	 * 	oQueuePending[oRequest.priority in oQueuePending ? oRequest.priority : "NORMAL"].push(oRequest);
	 * 	//
	 * 	setTimeout(fQueue_process);
	 * };
	 *
	 * function fQueue_remove(oRequest) {
	 * 	for (var nIndex = 0, bFound = false; nIndex < aQueueRunning.length; nIndex++)
	 * 	if (bFound) {
	 * 		aQueueRunning[nIndex - 1] = aQueueRunning[nIndex];
	 * 	} else {
	 * 		if (aQueueRunning[nIndex] == oRequest) {
	 * 			bFound  = true;
	 * 		}
	 * }
	 *
	 * 	if (bFound) {
	 * 		aQueueRunning.length--;
	 * 	}
	 *
	 *
	 * 	//
	 * 	setTimeout(fQueue_process);
	 * };
	 *
	 * function fQueue_process() {
	 * if (aQueueRunning.length < 6) {
	 * for (var sPriority in oQueuePending) {
	 * if (oQueuePending[sPriority].length) {
	 * var oRequest  = oQueuePending[sPriority][0];
	 * oQueuePending[sPriority]  = oQueuePending[sPriority].slice(1);
	 * //
	 * aQueueRunning.push(oRequest);
	 * // Send request
	 * fXMLHttpRequest_send(oRequest);
	 * break;
	 * }
	 * }
	 * }
	 * };
	 */

	// Helper function
	function fXMLHttpRequest_send(oRequest) {
		oRequest._object.send(oRequest._data);

		// BUGFIX: Gecko - missing readystatechange calls in synchronous requests
		if (bGecko && !oRequest._async) {
			oRequest.readyState = cXMLHttpRequest.OPENED;

			// Synchronize state
			fSynchronizeValues(oRequest);

			// Simulate missing states
			while (oRequest.readyState < cXMLHttpRequest.DONE) {
				oRequest.readyState++;
				fReadyStateChange(oRequest);
				// Check if we are aborted
				if (oRequest._aborted) {
					return;
				}
			}
		}
	}

	function fReadyStateChange(oRequest) {
		// Sniffing code
		if (cXMLHttpRequest.onreadystatechange){
			cXMLHttpRequest.onreadystatechange.apply(oRequest);
		}


		// Fake event
		oRequest.dispatchEvent({
			'type':       "readystatechange",
			'bubbles':    false,
			'cancelable': false,
			'timeStamp':  new Date + 0
		});
	}

	function fGetDocument(oRequest) {
		var oDocument = oRequest.responseXML;
		var sResponse = oRequest.responseText;
		// Try parsing responseText
		if (bIE && sResponse && oDocument && !oDocument.documentElement && oRequest.getResponseHeader("Content-Type").match(/[^\/]+\/[^\+]+\+xml/)) {
			oDocument = new window.ActiveXObject("Microsoft.XMLDOM");
			oDocument.async       = false;
			oDocument.validateOnParse = false;
			oDocument.loadXML(sResponse);
		}

		// Check if there is no error in document
		if (oDocument){
			if ((bIE && oDocument.parseError !== 0) || !oDocument.documentElement || (oDocument.documentElement && oDocument.documentElement.tagName == "parsererror")) {
				return null;
			}
		}
		return oDocument;
	}

	function fSynchronizeValues(oRequest) {
		try { oRequest.responseText = oRequest._object.responseText;  } catch (e) {}
		try { oRequest.responseXML  = fGetDocument(oRequest._object); } catch (e) {}
		try { oRequest.status       = oRequest._object.status;        } catch (e) {}
		try { oRequest.statusText   = oRequest._object.statusText;    } catch (e) {}
	}

	function fCleanTransport(oRequest) {
		// BUGFIX: IE - memory leak (on-page leak)
		oRequest._object.onreadystatechange = new window.Function;
	}

	// Internet Explorer 5.0 (missing apply)
	if (!window.Function.prototype.apply) {
		window.Function.prototype.apply = function(oRequest, oArguments) {
			if (!oArguments) {
				oArguments  = [];
			}
			oRequest.__func = this;
			oRequest.__func(oArguments[0], oArguments[1], oArguments[2], oArguments[3], oArguments[4]);
			delete oRequest.__func;
		};
	}

	// Register new object with window
	window.XMLHttpRequest = cXMLHttpRequest;

})();

    // End browser file: XMLHttpRequest.js
  }
}(typeof window !== 'undefined' ? window : {});

});

require.define("/lib/xmpp/websockets.js",function(require,module,exports,__dirname,__filename,process,global){var EventEmitter = require('events').EventEmitter;
var util = require('util');
var ltx = require('ltx');
var StreamParser = require('./stream_parser');
var WebSocket;
if (process.title === 'browser') {
    WebSocket = window.WebSocket;
} else {
    var wsPath = "faye-websocket";
    WebSocket = require(wsPath).Client;  // HACK: omit from browserify bundle
}

var NS_STREAM = exports.NS_STREAM = 'http://etherx.jabber.org/streams';
var NS_XMPP_STREAMS = 'urn:ietf:params:xml:ns:xmpp-streams';

function WSConnection(url) {
    EventEmitter.call(this);

    this.url = url;
    this.xmlns = {};
    this.websocket = new WebSocket(this.url, ['xmpp']);
    this.websocket.onopen = this.onopen.bind(this);
    this.websocket.onmessage = this.onmessage.bind(this);
    this.websocket.onclose = this.onclose.bind(this);
    this.websocket.onerror = this.onerror.bind(this);
}
util.inherits(WSConnection, EventEmitter);
exports.WSConnection = WSConnection;

WSConnection.prototype.maxStanzaSize = 65535;

WSConnection.prototype.onopen = function() {
    this.emit('connected');
    this.startParser();
};

WSConnection.prototype.startParser = function() {
    var self = this;
    this.parser = new StreamParser.StreamParser(this.maxStanzaSize);

    this.parser.addListener('start', function(attrs) {
        self.streamAttrs = attrs;
        /* We need those xmlns often, store them extra */
        self.streamNsAttrs = {};
        for(var k in attrs) {
        if (k == 'xmlns' ||
            k.substr(0, 6) == 'xmlns:')
                self.streamNsAttrs[k] = attrs[k];
        }

        /* Notify in case we don't wait for <stream:features/>
           (Component or non-1.0 streams)
         */
        self.emit('streamStart', attrs);
    });
    this.parser.addListener('stanza', function(stanza) {
        //self.onStanza(self.addStreamNs(stanza));
        self.onStanza(stanza);
    });
    this.parser.addListener('error', this.onerror.bind(this));
    this.parser.addListener('end', function() {
        self.stopParser();
        self.end();
    });
};

WSConnection.prototype.stopParser = function() {
    /* No more events, please (may happen however) */
    if(this.parser) {
        /* Get GC'ed */
        delete this.parser;
    }
};

WSConnection.prototype.onmessage = function(msg) {
    console.log("ws msg", msg.data);
    if (msg && msg.data && this.parser)
	this.parser.write(msg.data);
};

WSConnection.prototype.onStanza = function(stanza) {
    if (stanza.is('error', NS_STREAM)) {
        /* TODO: extract error text */
        this.emit('error', stanza);
    } else {
        this.emit('stanza', stanza);
    }
};

WSConnection.prototype.startStream = function() {
    var attrs = {};
    for(var k in this.xmlns) {
        if (this.xmlns.hasOwnProperty(k)) {
            if (!k)
                attrs.xmlns = this.xmlns[k];
            else
                attrs['xmlns:' + k] = this.xmlns[k];
        }
    }
    if (this.xmppVersion)
        attrs.version = this.xmppVersion;
    if (this.streamTo)
        attrs.to = this.streamTo;
    if (this.streamId)
        attrs.id = this.streamId;

    var el = new ltx.Element('stream:stream', attrs);
    // make it non-empty to cut the closing tag
    el.t(' ');
    var s = el.toString();
    this.send(s.substr(0, s.indexOf(' </stream:stream>')));

    this.streamOpened = true;
};

WSConnection.prototype.send = function(stanza) {
    if (stanza.root)
	stanza = stanza.root();
    stanza = stanza.toString();
    console.log("ws send", stanza);
    this.websocket.send(stanza);
};

WSConnection.prototype.onclose = function() {
};

WSConnection.prototype.end = function() {
    this.send("</stream:stream>");
    if (this.websocket)
	this.websocket.close();
};

WSConnection.prototype.onerror = function(e) {
    this.emit('error', e);
};

});

require.define("/lib/xmpp/jid.js",function(require,module,exports,__dirname,__filename,process,global){try {
    var stringprepPath = 'node-stringprep';
    var StringPrep = require(stringprepPath).StringPrep;  // HACK: omit from browserify bundle
    var toUnicode = require(stringprepPath).toUnicode;
    var c = function(n) {
	var p = new StringPrep(n);
	return function(s) {
	    return p.prepare(s);
	};
    };
    var nameprep = c('nameprep');
    var nodeprep = c('nodeprep');
    var resourceprep = c('resourceprep');
} catch(ex) {
    console.warn("Cannot load StringPrep-0.1.0 bindings. You may need to `npm install node-stringprep'");
    var identity = function(a) { return a; };
    var toLower = function(a) { return a.toLowerCase(); };
    var toUnicode = identity;
    var nameprep = toLower;
    var nodeprep = toLower;
    var resourceprep = identity;
}

function JID(a, b, c) {
    if (a && b == null && c == null) {
        this.parseJID(a);
    } else if (b) {
        this.setUser(a);
        this.setDomain(b);
        this.setResource(c);
    } else
        throw new Error('Argument error');
}

JID.prototype.parseJID = function(s) {
    if (s.indexOf('@') >= 0) {
        this.setUser(s.substr(0, s.indexOf('@')));
        s = s.substr(s.indexOf('@') + 1);
    }
    if (s.indexOf('/') >= 0) {
        this.setResource(s.substr(s.indexOf('/') + 1));
        s = s.substr(0, s.indexOf('/'));
    }
    this.setDomain(s);
};

JID.prototype.toString = function() {
    var s = this.domain;
    if (this.user)
        s = this.user + '@' + s;
    if (this.resource)
        s = s + '/' + this.resource;
    return s;
};

/**
 * Convenience method to distinguish users
 **/
JID.prototype.bare = function() {
    if (this.resource)
        return new JID(this.user, this.domain, null);
    else
        return this;
};

/**
 * Comparison function
 **/
JID.prototype.equals = function(other) {
    return this.user == other.user &&
        this.domain == other.domain &&
        this.resource == other.resource;
};

/**
 * Setters that do stringprep normalization.
 **/
JID.prototype.setUser = function(user) {
    this.user = user && nodeprep(user);
};
/**
 * http://xmpp.org/rfcs/rfc6122.html#addressing-domain
 */
JID.prototype.setDomain = function(domain) {
    this.domain = domain &&
        nameprep(domain.split(".").
                 map(toUnicode).
                 join("."));
};
JID.prototype.setResource = function(resource) {
    this.resource = resource && resourceprep(resource);
};

if (typeof exports !== "undefined" && exports !== null) {
  exports.JID = JID;
} else if (typeof window !== "undefined" && window !== null) {
  window.JID = JID;
}

});

require.define("/lib/xmpp/srv.js",function(require,module,exports,__dirname,__filename,process,global){var dnsPath = 'dns'
var dns = require("dns");  // HACK: omit from browserify bundle
var EventEmitter = require('events').EventEmitter;

function compareNumbers(a, b) {
    a = parseInt(a, 10);
    b = parseInt(b, 10);
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    return 0;
}

function groupSrvRecords(addrs) {
    var groups = {};  // by priority
    addrs.forEach(function(addr) {
                      if (!groups.hasOwnProperty(addr.priority))
                          groups[addr.priority] = [];

                      groups[addr.priority].push(addr);
                  });

    var result = [];
    Object.keys(groups).sort(compareNumbers).forEach(function(priority) {
        var group = groups[priority];
        var totalWeight = 0;
        group.forEach(function(addr) {
            totalWeight += addr.weight;
        });
        var w = Math.floor(Math.random() * totalWeight);
        totalWeight = 0;
        var candidate = group[0];
        group.forEach(function(addr) {
            totalWeight += addr.weight;
            if (w < totalWeight)
                candidate = addr;
        });
        if (candidate)
            result.push(candidate);
    });
    return result;
}

function resolveSrv(name, cb) {
    dns.resolveSrv(name, function(err, addrs) {
        if (err) {
            /* no SRV record, try domain as A */
            cb(err);
        } else {
            var pending = 0, error, results = [];
            var cb1 = function(e, addrs1) {
                error = error || e;
                results = results.concat(addrs1);
                pending--;
                if (pending < 1) {
                    cb(results ? null : error, results);
                }
            };
	    var gSRV = groupSrvRecords(addrs);
	    pending = gSRV.length;
	    gSRV.forEach(function(addr) {
                resolveHost(addr.name, function(e, a) {
                    if (a)
                        a = a.map(function(a1) {
                                      return { name: a1,
                                               port: addr.port };
                                  });
                    cb1(e, a);
                });
            });
        }
    });
}

// one of both A & AAAA, in case of broken tunnels
function resolveHost(name, cb) {
    var error, results = [];
    var cb1 = function(e, addr) {
        error = error || e;
        if (addr)
            results.push(addr);

        cb((results.length > 0) ? null : error, results);
    };

    dns.lookup(name, cb1);
}

// connection attempts to multiple addresses in a row
function tryConnect(socket, addrs, listener) {
    var onConnect = function() {
        socket.removeListener('connect', onConnect);
        socket.removeListener('error', onError);
        // done!
        listener.emit('connect');
    };
    var error;
    var onError = function(e) {
        error = e;
        connectNext();
    };
    var connectNext = function() {
        var addr = addrs.shift();
        if (addr)
            socket.connect(addr.port, addr.name);
        else {
            socket.removeListener('connect', onConnect);
            socket.removeListener('error', onError);
            listener.emit('error', error || new Error('No addresses to connect to'));
	}
    };
    socket.addListener('connect', onConnect);
    socket.addListener('error', onError);
    connectNext();
}

// returns EventEmitter with 'connect' & 'error'
exports.connect = function(socket, services, domain, defaultPort) {
    var listener = new EventEmitter();

    var tryServices = function() {
        var service = services.shift();
        if (service) {
            resolveSrv(service + '.' + domain, function(error, addrs) {
                if (addrs)
                    tryConnect(socket, addrs, listener);
                else
                    tryServices();
            });
        } else {
            resolveHost(domain, function(error, addrs) {
                if (addrs && addrs.length > 0) {
                    addrs = addrs.map(function(addr) {
                        return { name: addr,
                                 port: defaultPort };
                    });
                    tryConnect(socket, addrs, listener);
                }
                else {
                    listener.emit('error', error || new Error('No addresses resolved for ' + domain));
                }
            });
        }

    };
    tryServices();

    return listener;
};

});

require.define("/lib/xmpp/sasl.js",function(require,module,exports,__dirname,__filename,process,global){var querystring = require('querystring');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 * What's available for client-side authentication (Client)
 *
 * @param {Array} mechs Server-offered SASL mechanism names
 */
function selectMechanism(offeredMechs, preferredMech, availableMech) {
    var mechClasses = [XOAuth2, XFacebookPlatform, DigestMD5,
		       Plain, Anonymous];
    var byName = {};
    var mech;
    if (Array.isArray(availableMech)) {
        mechClasses = mechClasses.concat(availableMech);
    }
    mechClasses.forEach(function(mechClass) {
	byName[mechClass.prototype.name] = mechClass;
    });
    /* Any preferred? */
    if (byName[preferredMech]) {
	mech = byName[preferredMech];
    }
    /* By priority */
    mechClasses.forEach(function(mechClass) {
	if (!mech &&
	    offeredMechs.indexOf(mechClass.prototype.name) >= 0)
	    mech = mechClass;
    });

    return mech ? new mech() : null;
}

exports.selectMechanism = selectMechanism;

/**
 * What's available for server-side authentication (C2S)
 */
function availableMechanisms(availableMech) {
    var mechanisms = [new Plain()];
    if (availableMech) {
        mechanisms = mechanisms.concat(availableMech);
    }
    return mechanisms;
}
exports.availableMechanisms = availableMechanisms;

// Mechanisms
function Mechanism() {
}
util.inherits(Mechanism, EventEmitter);
Mechanism.authAttrs = function() {
    return {};
};

function Plain() {
}
util.inherits(Plain, Mechanism);
Plain.prototype.name = "PLAIN";
Plain.prototype.auth = function() {
    return this.authzid + "\0" +
        this.authcid + "\0" +
        this.password;
};
Plain.prototype.authServer = function(auth, client) {
    var params = auth.split("\x00");
    this.username = params[1];
    client.authenticate(this.username, params[2]);
};

function XOAuth2() {
}
util.inherits(XOAuth2, Mechanism);
XOAuth2.prototype.name = "X-OAUTH2";
XOAuth2.prototype.auth = function() {
    return "\0" + this.authzid + "\0" + this.oauth2_token;
};
XOAuth2.prototype.authServer = function(auth, client) {
    var params = auth.split("\x00");
    this.username = params[1];
    client.authenticate(this.username, params[2]);
};
XOAuth2.prototype.authAttrs = function() {
    return { "auth:service": "oauth2",
	     "xmlns:auth": this.oauth2_auth
    };
};

function XFacebookPlatform() {
}
util.inherits(XFacebookPlatform, Mechanism);
XFacebookPlatform.prototype.name = "X-FACEBOOK-PLATFORM";
XFacebookPlatform.prototype.auth = function() {
    return "";
};
XFacebookPlatform.prototype.challenge = function(s) {
    var dict = querystring.parse(s);

    var response = {
        api_key: this.api_key,
        call_id: new Date().getTime(),
        method: dict.method,
        nonce: dict.nonce,
        access_token: this.access_token,
        v: "1.0"
    };

    return querystring.stringify(response);
};

function Anonymous() {
}
util.inherits(Anonymous, Mechanism);
Anonymous.prototype.name = "ANONYMOUS";
Anonymous.prototype.auth = function() {
    return this.authzid;
};

function External() {
}
util.inherits(External, Mechanism);
External.prototype.name = "EXTERNAL";
External.prototype.auth = function() {
    return(this.authzid);
};

exports.External = External;

function DigestMD5() {
    this.nonce_count = 0;
    this.cnonce = generateNonce();
}
util.inherits(DigestMD5, Mechanism);
DigestMD5.prototype.name = "DIGEST-MD5";
DigestMD5.prototype.auth = function() {
    return "";
};
DigestMD5.prototype.getNC = function() {
    return rjust(this.nonce_count.toString(), 8, '0');
};
DigestMD5.prototype.responseValue = function(s) {
    var dict = parseDict(s);
    if (dict.realm)
        this.realm = dict.realm;

    var value;
    if (dict.nonce && dict.qop) {
        this.nonce_count++;
        var a1 = md5(this.authcid + ':' +
                     this.realm + ':' +
                     this.password) + ':' +
                     dict.nonce + ':' +
                     this.cnonce + ':' +
                     this.authzid || "";
        var a2 = "AUTHENTICATE:" + this.digest_uri;
        if (dict.qop == 'auth-int' || dict.qop == 'auth-conf')
            a2 += ":00000000000000000000000000000000";

        value = md5_hex(md5_hex(a1) + ':' +
                        dict.nonce + ':' +
                        this.getNC() + ':' +
                        this.cnonce + ':' +
                        dict.qop + ':' +
                        md5_hex(a2));
    }
    return value;
};
DigestMD5.prototype.challenge = function(s) {
    var dict = parseDict(s);
    if (dict.realm)
        this.realm = dict.realm;

    var response;
    if (dict.nonce && dict.qop) {
        var responseValue = this.responseValue(s);
        response = {
            username: this.authcid,
            realm: this.realm,
            nonce: dict.nonce,
            cnonce: this.cnonce,
            nc: this.getNC(),
            qop: dict.qop,
            'digest-uri': this.digest_uri,
            response: responseValue,
            authzid: this.authzid || "",
            charset: 'utf-8'
        };
    } else if (dict.rspauth) {
        return "";
    }
    return encodeDict(response);
};
DigestMD5.prototype.serverChallenge = function() {
    var dict = {};
    dict.realm = "";
    this.nonce = dict.nonce = generateNonce();
    dict.qop = "auth";
    this.charset = dict.charset = "utf-8";
    dict.algorithm = "md5-sess";
    return encodeDict(dict);
};

// Used on the server to check for auth!
DigestMD5.prototype.response = function(s) {
    var dict = parseDict(s);
    this.authcid = dict.username;
    if(dict.nonce != this.nonce) {
        return false;
    }
    if(!dict.cnonce) {
        return false;
    }
    this.cnonce = dict.cnonce;
    if(this.charset != dict.charset) {
        return false;
    }
    this.response = dict.response;
    return true;
};

/**
 * Parse SASL serialization
 */
function parseDict(s) {
    var result = {};
    while (s) {
        var m;
        if((m = /^(.+?)=(.*?[^\\]),(.*)/.exec(s))) {
            result[m[1]] = m[2].replace(/\"/g, '');
            s = m[3];
        } else if ((m = /^(.+?)=(.+?),(.*)/.exec(s))) {
            result[m[1]] = m[2];
            s = m[3];
        } else if ((m = /^(.+?)="(.*?[^\\])"$/.exec(s))) {
            result[m[1]] = m[2];
            s = m[3];
        } else if ((m = /^(.+?)=(.+?)$/.exec(s))) {
            result[m[1]] = m[2];
            s = m[3];
        } else {
            s = null;
        }
    }
    return result;
}

/**
 * SASL serialization
 */
function encodeDict(dict) {
    var s = "";
    for(k in dict) {
        var v = dict[k];
        if (v)
            s += ',' + k + '="' + v + '"';
    }
    return s.substr(1);  // without first ','
}

/**
 * Right-justify a string,
 * eg. pad with 0s
 */
function rjust(s, targetLen, padding) {
    while(s.length < targetLen)
        s = padding + s;
    return s;
}

/**
 * Hash a string
 */
var md5, md5_hex;
if (process.title !== 'browser') {
    var crypto = require('crypto');
    md5 = function(s, encoding) {
	var hash = crypto.createHash('md5');
	hash.update(s);
	return hash.digest(encoding || 'binary');
    };
    md5_hex = function(s) {
	return md5(s, 'hex');
    };
} else {
    var md5lib = require('blueimp-md5').md5;
    //console.log("md5lib",md5lib);
    md5 = function(s) {
	//console.log("md5", s, md5lib(s, null, true));
	return md5lib(s, null, true);
    };
    md5_hex = function(s) {
	//console.log("md5_hex", s, md5lib(s));
	return md5lib(s);
    };
}

/**
 * Generate a string of 8 digits
 * (number used once)
 */
function generateNonce() {
    var result = "";
    for(var i = 0; i < 8; i++)
        result += String.fromCharCode(48 +
                                      Math.ceil(Math.random() * 10));
    return result;
}

});

require.define("querystring",function(require,module,exports,__dirname,__filename,process,global){var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.prototype.toString.call(xs) === '[object Array]'
    };

var objectKeys = Object.keys || function objectKeys(object) {
    if (object !== Object(object)) throw new TypeError('Invalid object');
    var keys = [];
    for (var key in object) if (object.hasOwnProperty(key)) keys[keys.length] = key;
    return keys;
}


/*!
 * querystring
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Library version.
 */

exports.version = '0.3.1';

/**
 * Object#toString() ref for stringify().
 */

var toString = Object.prototype.toString;

/**
 * Cache non-integer test regexp.
 */

var notint = /[^0-9]/;

/**
 * Parse the given query `str`, returning an object.
 *
 * @param {String} str
 * @return {Object}
 * @api public
 */

exports.parse = function(str){
  if (null == str || '' == str) return {};

  function promote(parent, key) {
    if (parent[key].length == 0) return parent[key] = {};
    var t = {};
    for (var i in parent[key]) t[i] = parent[key][i];
    parent[key] = t;
    return t;
  }

  return String(str)
    .split('&')
    .reduce(function(ret, pair){
      try{ 
        pair = decodeURIComponent(pair.replace(/\+/g, ' '));
      } catch(e) {
        // ignore
      }

      var eql = pair.indexOf('=')
        , brace = lastBraceInKey(pair)
        , key = pair.substr(0, brace || eql)
        , val = pair.substr(brace || eql, pair.length)
        , val = val.substr(val.indexOf('=') + 1, val.length)
        , parent = ret;

      // ?foo
      if ('' == key) key = pair, val = '';

      // nested
      if (~key.indexOf(']')) {
        var parts = key.split('[')
          , len = parts.length
          , last = len - 1;

        function parse(parts, parent, key) {
          var part = parts.shift();

          // end
          if (!part) {
            if (isArray(parent[key])) {
              parent[key].push(val);
            } else if ('object' == typeof parent[key]) {
              parent[key] = val;
            } else if ('undefined' == typeof parent[key]) {
              parent[key] = val;
            } else {
              parent[key] = [parent[key], val];
            }
          // array
          } else {
            obj = parent[key] = parent[key] || [];
            if (']' == part) {
              if (isArray(obj)) {
                if ('' != val) obj.push(val);
              } else if ('object' == typeof obj) {
                obj[objectKeys(obj).length] = val;
              } else {
                obj = parent[key] = [parent[key], val];
              }
            // prop
            } else if (~part.indexOf(']')) {
              part = part.substr(0, part.length - 1);
              if(notint.test(part) && isArray(obj)) obj = promote(parent, key);
              parse(parts, obj, part);
            // key
            } else {
              if(notint.test(part) && isArray(obj)) obj = promote(parent, key);
              parse(parts, obj, part);
            }
          }
        }

        parse(parts, parent, 'base');
      // optimize
      } else {
        if (notint.test(key) && isArray(parent.base)) {
          var t = {};
          for(var k in parent.base) t[k] = parent.base[k];
          parent.base = t;
        }
        set(parent.base, key, val);
      }

      return ret;
    }, {base: {}}).base;
};

/**
 * Turn the given `obj` into a query string
 *
 * @param {Object} obj
 * @return {String}
 * @api public
 */

var stringify = exports.stringify = function(obj, prefix) {
  if (isArray(obj)) {
    return stringifyArray(obj, prefix);
  } else if ('[object Object]' == toString.call(obj)) {
    return stringifyObject(obj, prefix);
  } else if ('string' == typeof obj) {
    return stringifyString(obj, prefix);
  } else {
    return prefix;
  }
};

/**
 * Stringify the given `str`.
 *
 * @param {String} str
 * @param {String} prefix
 * @return {String}
 * @api private
 */

function stringifyString(str, prefix) {
  if (!prefix) throw new TypeError('stringify expects an object');
  return prefix + '=' + encodeURIComponent(str);
}

/**
 * Stringify the given `arr`.
 *
 * @param {Array} arr
 * @param {String} prefix
 * @return {String}
 * @api private
 */

function stringifyArray(arr, prefix) {
  var ret = [];
  if (!prefix) throw new TypeError('stringify expects an object');
  for (var i = 0; i < arr.length; i++) {
    ret.push(stringify(arr[i], prefix + '[]'));
  }
  return ret.join('&');
}

/**
 * Stringify the given `obj`.
 *
 * @param {Object} obj
 * @param {String} prefix
 * @return {String}
 * @api private
 */

function stringifyObject(obj, prefix) {
  var ret = []
    , keys = objectKeys(obj)
    , key;
  for (var i = 0, len = keys.length; i < len; ++i) {
    key = keys[i];
    ret.push(stringify(obj[key], prefix
      ? prefix + '[' + encodeURIComponent(key) + ']'
      : encodeURIComponent(key)));
  }
  return ret.join('&');
}

/**
 * Set `obj`'s `key` to `val` respecting
 * the weird and wonderful syntax of a qs,
 * where "foo=bar&foo=baz" becomes an array.
 *
 * @param {Object} obj
 * @param {String} key
 * @param {String} val
 * @api private
 */

function set(obj, key, val) {
  var v = obj[key];
  if (undefined === v) {
    obj[key] = val;
  } else if (isArray(v)) {
    v.push(val);
  } else {
    obj[key] = [v, val];
  }
}

/**
 * Locate last brace in `str` within the key.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function lastBraceInKey(str) {
  var len = str.length
    , brace
    , c;
  for (var i = 0; i < len; ++i) {
    c = str[i];
    if (']' == c) brace = false;
    if ('[' == c) brace = true;
    if ('=' == c && !brace) return i;
  }
}

});

require.define("/node_modules/blueimp-md5/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"md5.js"}
});

require.define("/node_modules/blueimp-md5/md5.js",function(require,module,exports,__dirname,__filename,process,global){/*
 * JavaScript MD5 1.0
 * https://github.com/blueimp/JavaScript-MD5
 *
 * Copyright 2011, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 * 
 * Based on
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */

/*jslint bitwise: true */
/*global unescape, define */

(function ($) {
    'use strict';

    /*
    * Add integers, wrapping at 2^32. This uses 16-bit operations internally
    * to work around bugs in some JS interpreters.
    */
    function safe_add(x, y) {
        var lsw = (x & 0xFFFF) + (y & 0xFFFF),
            msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    }

    /*
    * Bitwise rotate a 32-bit number to the left.
    */
    function bit_rol(num, cnt) {
        return (num << cnt) | (num >>> (32 - cnt));
    }

    /*
    * These functions implement the four basic operations the algorithm uses.
    */
    function md5_cmn(q, a, b, x, s, t) {
        return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
    }
    function md5_ff(a, b, c, d, x, s, t) {
        return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }
    function md5_gg(a, b, c, d, x, s, t) {
        return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }
    function md5_hh(a, b, c, d, x, s, t) {
        return md5_cmn(b ^ c ^ d, a, b, x, s, t);
    }
    function md5_ii(a, b, c, d, x, s, t) {
        return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
    }

    /*
    * Calculate the MD5 of an array of little-endian words, and a bit length.
    */
    function binl_md5(x, len) {
        /* append padding */
        x[len >> 5] |= 0x80 << ((len) % 32);
        x[(((len + 64) >>> 9) << 4) + 14] = len;

        var i, olda, oldb, oldc, oldd,
            a =  1732584193,
            b = -271733879,
            c = -1732584194,
            d =  271733878;

        for (i = 0; i < x.length; i += 16) {
            olda = a;
            oldb = b;
            oldc = c;
            oldd = d;

            a = md5_ff(a, b, c, d, x[i],       7, -680876936);
            d = md5_ff(d, a, b, c, x[i +  1], 12, -389564586);
            c = md5_ff(c, d, a, b, x[i +  2], 17,  606105819);
            b = md5_ff(b, c, d, a, x[i +  3], 22, -1044525330);
            a = md5_ff(a, b, c, d, x[i +  4],  7, -176418897);
            d = md5_ff(d, a, b, c, x[i +  5], 12,  1200080426);
            c = md5_ff(c, d, a, b, x[i +  6], 17, -1473231341);
            b = md5_ff(b, c, d, a, x[i +  7], 22, -45705983);
            a = md5_ff(a, b, c, d, x[i +  8],  7,  1770035416);
            d = md5_ff(d, a, b, c, x[i +  9], 12, -1958414417);
            c = md5_ff(c, d, a, b, x[i + 10], 17, -42063);
            b = md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
            a = md5_ff(a, b, c, d, x[i + 12],  7,  1804603682);
            d = md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
            c = md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
            b = md5_ff(b, c, d, a, x[i + 15], 22,  1236535329);

            a = md5_gg(a, b, c, d, x[i +  1],  5, -165796510);
            d = md5_gg(d, a, b, c, x[i +  6],  9, -1069501632);
            c = md5_gg(c, d, a, b, x[i + 11], 14,  643717713);
            b = md5_gg(b, c, d, a, x[i],      20, -373897302);
            a = md5_gg(a, b, c, d, x[i +  5],  5, -701558691);
            d = md5_gg(d, a, b, c, x[i + 10],  9,  38016083);
            c = md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
            b = md5_gg(b, c, d, a, x[i +  4], 20, -405537848);
            a = md5_gg(a, b, c, d, x[i +  9],  5,  568446438);
            d = md5_gg(d, a, b, c, x[i + 14],  9, -1019803690);
            c = md5_gg(c, d, a, b, x[i +  3], 14, -187363961);
            b = md5_gg(b, c, d, a, x[i +  8], 20,  1163531501);
            a = md5_gg(a, b, c, d, x[i + 13],  5, -1444681467);
            d = md5_gg(d, a, b, c, x[i +  2],  9, -51403784);
            c = md5_gg(c, d, a, b, x[i +  7], 14,  1735328473);
            b = md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

            a = md5_hh(a, b, c, d, x[i +  5],  4, -378558);
            d = md5_hh(d, a, b, c, x[i +  8], 11, -2022574463);
            c = md5_hh(c, d, a, b, x[i + 11], 16,  1839030562);
            b = md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
            a = md5_hh(a, b, c, d, x[i +  1],  4, -1530992060);
            d = md5_hh(d, a, b, c, x[i +  4], 11,  1272893353);
            c = md5_hh(c, d, a, b, x[i +  7], 16, -155497632);
            b = md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
            a = md5_hh(a, b, c, d, x[i + 13],  4,  681279174);
            d = md5_hh(d, a, b, c, x[i],      11, -358537222);
            c = md5_hh(c, d, a, b, x[i +  3], 16, -722521979);
            b = md5_hh(b, c, d, a, x[i +  6], 23,  76029189);
            a = md5_hh(a, b, c, d, x[i +  9],  4, -640364487);
            d = md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
            c = md5_hh(c, d, a, b, x[i + 15], 16,  530742520);
            b = md5_hh(b, c, d, a, x[i +  2], 23, -995338651);

            a = md5_ii(a, b, c, d, x[i],       6, -198630844);
            d = md5_ii(d, a, b, c, x[i +  7], 10,  1126891415);
            c = md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
            b = md5_ii(b, c, d, a, x[i +  5], 21, -57434055);
            a = md5_ii(a, b, c, d, x[i + 12],  6,  1700485571);
            d = md5_ii(d, a, b, c, x[i +  3], 10, -1894986606);
            c = md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
            b = md5_ii(b, c, d, a, x[i +  1], 21, -2054922799);
            a = md5_ii(a, b, c, d, x[i +  8],  6,  1873313359);
            d = md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
            c = md5_ii(c, d, a, b, x[i +  6], 15, -1560198380);
            b = md5_ii(b, c, d, a, x[i + 13], 21,  1309151649);
            a = md5_ii(a, b, c, d, x[i +  4],  6, -145523070);
            d = md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
            c = md5_ii(c, d, a, b, x[i +  2], 15,  718787259);
            b = md5_ii(b, c, d, a, x[i +  9], 21, -343485551);

            a = safe_add(a, olda);
            b = safe_add(b, oldb);
            c = safe_add(c, oldc);
            d = safe_add(d, oldd);
        }
        return [a, b, c, d];
    }

    /*
    * Convert an array of little-endian words to a string
    */
    function binl2rstr(input) {
        var i,
            output = '';
        for (i = 0; i < input.length * 32; i += 8) {
            output += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xFF);
        }
        return output;
    }

    /*
    * Convert a raw string to an array of little-endian words
    * Characters >255 have their high-byte silently ignored.
    */
    function rstr2binl(input) {
        var i,
            output = [];
        output[(input.length >> 2) - 1] = undefined;
        for (i = 0; i < output.length; i += 1) {
            output[i] = 0;
        }
        for (i = 0; i < input.length * 8; i += 8) {
            output[i >> 5] |= (input.charCodeAt(i / 8) & 0xFF) << (i % 32);
        }
        return output;
    }

    /*
    * Calculate the MD5 of a raw string
    */
    function rstr_md5(s) {
        return binl2rstr(binl_md5(rstr2binl(s), s.length * 8));
    }

    /*
    * Calculate the HMAC-MD5, of a key and some data (raw strings)
    */
    function rstr_hmac_md5(key, data) {
        var i,
            bkey = rstr2binl(key),
            ipad = [],
            opad = [],
            hash;
        ipad[15] = opad[15] = undefined;
        if (bkey.length > 16) {
            bkey = binl_md5(bkey, key.length * 8);
        }
        for (i = 0; i < 16; i += 1) {
            ipad[i] = bkey[i] ^ 0x36363636;
            opad[i] = bkey[i] ^ 0x5C5C5C5C;
        }
        hash = binl_md5(ipad.concat(rstr2binl(data)), 512 + data.length * 8);
        return binl2rstr(binl_md5(opad.concat(hash), 512 + 128));
    }

    /*
    * Convert a raw string to a hex string
    */
    function rstr2hex(input) {
        var hex_tab = '0123456789abcdef',
            output = '',
            x,
            i;
        for (i = 0; i < input.length; i += 1) {
            x = input.charCodeAt(i);
            output += hex_tab.charAt((x >>> 4) & 0x0F) +
                hex_tab.charAt(x & 0x0F);
        }
        return output;
    }

    /*
    * Encode a string as utf-8
    */
    function str2rstr_utf8(input) {
        return unescape(encodeURIComponent(input));
    }

    /*
    * Take string arguments and return either raw or hex encoded strings
    */
    function raw_md5(s) {
        return rstr_md5(str2rstr_utf8(s));
    }
    function hex_md5(s) {
        return rstr2hex(raw_md5(s));
    }
    function raw_hmac_md5(k, d) {
        return rstr_hmac_md5(str2rstr_utf8(k), str2rstr_utf8(d));
    }
    function hex_hmac_md5(k, d) {
        return rstr2hex(raw_hmac_md5(k, d));
    }

    function md5(string, key, raw) {
        if (!key) {
            if (!raw) {
                return hex_md5(string);
            }
            return raw_md5(string);
        }
        if (!raw) {
            return hex_hmac_md5(key, string);
        }
        return raw_hmac_md5(key, string);
    }

    if (typeof define === 'function' && define.amd) {
        define(function () {
            return md5;
        });
    } else {
        $.md5 = md5;
    }
}(this));

});

require.define("/lib/node-xmpp-browserify.js",function(require,module,exports,__dirname,__filename,process,global){var Connection = require('./xmpp/connection');
var Client = require('./xmpp/client').Client;
var JID = require('./xmpp/jid', 'JID');
var ltx = require('ltx');
var Stanza = require('./xmpp/stanza');

exports.Connection = Connection;
exports.Client = Client;
exports.JID = JID;
exports.Element = ltx.Element;
exports.Stanza = Stanza.Stanza;
exports.Message = Stanza.Message;
exports.Presence = Stanza.Presence;
exports.Iq = Stanza.Iq;

window.XMPP = exports;

});
require("/lib/node-xmpp-browserify.js");
})();
