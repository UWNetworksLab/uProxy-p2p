//XXX: needed for chrome debugging, used by socks.js and tcp-server.js.
var window = {};
console.log('SOCKS5 server: ' + self.location.href);

window.socket = freedom['core.socket']();

var onload = function() {
  var active = false;
  var transports = {};
  var webClients = {};
  var signallingChannels = {};

  var shutdown = function() {
    for (var contact in transports) {
      transports[contact].close();
    }
    transports = {};
    signallingChannels = {};
    active = false;
  };

  var onClose = function(from) {
    //conn.disconnect();
    for (var i in webClients[from]) {
      webclients[from][i]._onClose();
    }
    delete webClients[from];
    transports[from].close();
    delete transports[from];
    delete signallingChannels[from];
  };

  var initChannel = function(from, callback) {
    if (!transports[from]) {
      transports[from] = {};
      webClients[from] = {};
    }
    var transport = freedom.transport();
    transport.on('onClose', onClose.bind({}, from));
    transport.on('message', function(transport, from, msg) {
      var tag = msg.channelid;
      if (!webClients[from][tag]) {
        webClients[from][tag] = new window.webclient(transport.send.bind(transport, tag));
      }
      webClients[from][tag].onMessage(msg.data);
    }.bind({}, transport, from));
    transports[from] = transport;
    transport.signallingChannel = {
      _cb: [],
      on: function(what, cb) {
        this._cb.push(cb);
      }
    };

    var promise = freedom.core().createChannel();
    promise.done(function(f, cb, trans, chan) {
      chan.channel.done(function(f, cb, trans, channel) {
        channel.on('message', function(other, msg) {
          var outgoing = {
            to: other,
            data: msg
          };
          freedom.emit('fromServer', outgoing);
        }.bind({}, f));
        channel.on('ready', function(cb, f) {
          signallingChannels[f] = this;
          cb();
        }.bind(channel, callback, f));

        channel.on('ready', function(cbs) {
          for (var i = 0; i < cbs.length; i++) {
            cbs[i]();
          }
        }.bind({}, trans.signallingChannel._cb));
        trans.signallingChannel = channel;
      }.bind({}, f, cb, trans));
      // TODO: fix "false" to real boolean when Freedom supports it.
      trans.open(chan.identifier, false);
    }.bind({}, from, callback, transport));
  };

  freedom.on('start', function(options) {
    shutdown();
    active = true;
  });

  freedom.on('toServer', function(msg) {
    if (!active) {
      return;
    }

    console.log("sending to transport: " + JSON.stringify(msg.data));
    if (!transports[msg.from]) {
      // Make a channel.
      initChannel(msg.from, function(m) {
        signallingChannels[m.from].emit('message', m.data);
      }.bind(this, msg));
    } else if (!signallingChannels[msg.from]){
      transports[msg.from].signallingChannel.on('ready', function(m) {
        signallingChannels[m.from].emit('message', m.data);
      }.bind(this, msg));
    } else {
      signallingChannels[msg.from].emit('message', msg.data);
    }
  });

  freedom.on('stop', shutdown);

  freedom.emit('ready', {});
}

//TODO(willscott): WebWorker startup errors are hard to debug.
// Once fixed, code can be executed synchronously.
setTimeout(onload, 0);
