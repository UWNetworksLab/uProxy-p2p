module.exports = {
  "dns": {
    action: 'define',
		with: 'dns.js',
		from: module
  },
	"_stream_readable": {
		action: 'define',
		with: 'streamHelpers/node-chrome-stream-readable.js',
		from: module
	},
	"_stream_writable": {
		action: 'define',
		with: 'streamHelpers/node-chrome-stream-writable.js',
		from: module
	},
	"_stream_duplex": {
		action: 'define',
		with: 'streamHelpers/node-chrome-stream-duplex.js',
		from: module
	},
	"net.js": {
		action: 'replace',
		with: 'net.js',
		from: module
	},
	"stream.js": {
		action: 'patch',
		rules: [{
			from: 'Stream.Stream',
			to: 'Stream.Readable = require(\'_stream_readable\');\nStream.Writable = require(\'_stream_writable\');\nStream.Duplex = require(\'_stream_duplex\');\nStream.Stream'
		}]
	},
	"ender/xmlhttprequest.js": {
		action: 'patch',
		rules: [
  		{
			  from: 'window = window',
				to: 'var unsafeKeys = {"locationbar":1, "menubar":1, "personalbar":1, "scrollbars":1, "statusbar":1, "toolbar":1, "localStorage":1};\nwindow = window'
		  }, {
		    from: 'if\\(window\\.hasOwnProperty\\(key\\)',
		    to: 'if(window.hasOwnProperty(key) && !unsafeKeys[key]'
		  }, {
			  from: 'window\\.document\\.all',
			  to: 'false'
		  }
	  ]
	},
  "lib/xmpp/sasl.js": {
    action: 'patch',
		rules: [{
      from: 'console\\.log',
      to: '//console.log'
		}]
  },
	"lib/xmpp/srv.js": {
		action: 'patch',
		rules: [{
			from: 'require\\(dnsPath\\)',
			to: 'require\(\"\dns\"\)'
		}]
	}
};