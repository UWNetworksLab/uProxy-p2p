/**
 * DataPeer
 * Assumes that RTCPeerConnection is defined.
 */
 (function (exports) {
   "use strict";

//-----------------------------------------------------------------------------
// Console debugging utilities
//-----------------------------------------------------------------------------
// Abbreviation for console['type'] (type = log/warn/error) that inserts time at
// front.
function trace_to_console(type) {
  var argsArray = [];
  for (var i = 1; i < arguments.length; i++) {
    argsArray[i - 1] = arguments[i];
  }
  var text = argsArray[0];
  var s = (performance.now() / 1000).toFixed(3) + ": " + text;
  argsArray[0] = s;
  console[type].apply(console, argsArray);
}
var trace = {
  log: trace_to_console.bind(null, "log"),
  warn: trace_to_console.bind(null, "warn"),
  error: trace_to_console.bind(null, "error"),
};

//-----------------------------------------------------------------------------
// A class that wraps a peer connection and its data channels.
//-----------------------------------------------------------------------------
// TODO: check that Handling of pranswer is treated appropriately.
var SimpleDataPeerState = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED'
};

function SimpleDataPeer(peerName) {
  this.peerName = peerName;

  // depending on environment, select implementation.
  var RTCPeerConnection = RTCPeerConnection || webkitRTCPeerConnection || mozRTCPeerConnection;
  //TODO wire up STUN/TURN server config from options page
  var static_pc_config = [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:stun2.l.google.com:19302",
    "stun:stun3.l.google.com:19302",
    "stun:stun4.l.google.com:19302" // ,
    // "turn:stun.l.google.com:19302"
  ];

  var constraints = {optional: [{DtlsSrtpKeyAgreement: true}]};
  // A way to speak to the peer to send SDP headers etc.
  this._sendSignalMessage = null;

  this._pc = null;  // The peer connection.
  // Get TURN servers for the peer connection.
  var iceServer;
  var pc_config = {iceServers: []};
  for (var i = 0; i < static_pc_config.length; i++) {
    iceServer = { 'url' : static_pc_config[i] };
    pc_config.iceServers.push(iceServer);
  }
  this._pc = new RTCPeerConnection(pc_config, constraints);
  // Add basic event handlers.
  this._pc.addEventListener("icecandidate",
                            this._onIceCallback.bind(this));
  this._pc.addEventListener("negotiationneeded",
                            this._onNegotiationNeeded.bind(this));
  this._pc.addEventListener("signalingstatechange", function () {
    if (this._pc.signalingState == "stable") {
      this._pcState = SimpleDataPeerState.CONNECTED;
    }
  }.bind(this));
  // This state variable is used to fake offer/answer when they are wrongly
  // requested and we really just need to reuse what we already have.
  this._pcState = SimpleDataPeerState.DISCONNECTED;

  // Note: to actually do something with data channels opened by a peer, we
  // need someone to manage "datachannel" event.
}

// Queue 'func', a 0-arg closure, for invocation when the TURN server
// gets back to us, and we have a valid RTCPeerConnection in this._pc.
// If we already have it, run func immediately.
SimpleDataPeer.prototype.runWhenReady = function(func) {
  if (this._pc === null) {
    console.error('SimpleDataPeer: Something is terribly wrong. PeerConnection is null');
    // we're still waiting.
  } else {
    func();
  }
};

SimpleDataPeer.prototype.addPCEventListener = function(event, func) {
  this._pc_listeners.push({event: event, func: func});
};

SimpleDataPeer.prototype._onSignalingStateChange = function () {
//  trace.log(this.peerName + ": " + "_onSignalingStateChange: ",
//      this._pc.signalingState);
  if (this._pc.signalingState == "stable") {
    this._pcState = SimpleDataPeerState.CONNECTED;
  }
};

SimpleDataPeer.prototype.setSendSignalMessage = function (sendSignalMessageFn) {
  this._sendSignalMessage = sendSignalMessageFn;
};

// Handle a message send on the signalling channel to this peer.
SimpleDataPeer.prototype.handleSignalMessage = function (messageText) {
//  trace.log(this.peerName + ": " + "handleSignalMessage: \n" +
//      messageText);
  var json = JSON.parse(messageText);
  this.runWhenReady(function() {
    // TODO: If we are offering and they are also offerring at the same time,
    // pick the one who has the lower randomId?
    // (this._pc.signalingState == "have-local-offer" && json.sdp &&
    //    json.sdp.type == "offer" && json.sdp.randomId < this.localRandomId)
    if (json.sdp) {
      // Set the remote description.
      this._pc.setRemoteDescription(
          new RTCSessionDescription(json.sdp),
          // Success
          function () {
            if (this._pc.remoteDescription.type == "offer") {
              this._pc.createAnswer(this._onDescription.bind(this));
            }
          }.bind(this),
          // Failure
          function (e) {
            trace.error(this.peerName + ": " +
                "setRemoteDescription failed:", e);
          }.bind(this));
    } else if (json.candidate) {
      // Add remote ice candidate.
      console.log("Adding ice candidate: " + JSON.stringify(json.candidate));
      var ice_candidate = new RTCIceCandidate(json.candidate);
      this._pc.addIceCandidate(ice_candidate);
    } else {
      trace.warn(this.peerName + ": " +
          "handleSignalMessage got unexpected message: ", messageText);
    }
  }.bind(this));
};

// Connect to the peer by the signalling channel.
SimpleDataPeer.prototype.negotiateConnection = function () {
  this._pcState = SimpleDataPeerState.CONNECTING;
  this.runWhenReady(function() {
    this._pc.createOffer(
        this._onDescription.bind(this),
        function(e) {
          trace.error(this.peerName + ": " +
              "createOffer failed: ", e.toString());
          this._pcState = SimpleDataPeerState.DISCONNECTED;
        }.bind(this));
  }.bind(this));
};

// When we get our description, we set it to be our local description and
// send it to the peer.
SimpleDataPeer.prototype._onDescription = function (description) {
  this.runWhenReady(function() {
    if (this._sendSignalMessage) {
      this._pc.setLocalDescription(
          description, function() {
            this._sendSignalMessage(JSON.stringify({'sdp':description}));
          }.bind(this), function (e) { trace.error(this.peerName + ": " +
              "setLocalDescription failed:", e);
          }.bind(this));
    } else {
      trace.error(this.peerName + ": " +
          "_onDescription: _sendSignalMessage is not set, so we did not " +
              "set the local description. ");
    }
  }.bind(this));
};

SimpleDataPeer.prototype.close = function() {
  this._pc.close();
  // trace.log(this.peerName + ": " + "Closed peer connection.");
};

//
SimpleDataPeer.prototype._onNegotiationNeeded = function (e) {
  // trace.log(this.peerName + ": " + "_onNegotiationNeeded", this._pc, e);
  if(this._pcState != SimpleDataPeerState.DISCONNECTED) {
    // Negotiation messages are falsely requested for new data channels.
    //   https://code.google.com/p/webrtc/issues/detail?id=2431
    // This code is a hack to simply reset the same local and remote
    // description which will trigger the appropriate data channel open event.
    // TODO: fix/remove this when Chrome issue is fixed.
    var logSuccess = function (op) { return function() {
      //trace.log(this.peerName + ": " + op + " succeeded ");
    }.bind(this); }.bind(this);
    var logFail = function (op) { return function(e) {
      //trace.log(this.peerName + ": " + op + " failed: " + e);
    }.bind(this); }.bind(this);
    if (this._pc.localDescription && this._pc.remoteDescription &&
        this._pc.localDescription.type == "offer") {
      this._pc.setLocalDescription(this._pc.localDescription,
                                   logSuccess("setLocalDescription"),
                                   logFail("setLocalDescription"));
      this._pc.setRemoteDescription(this._pc.remoteDescription,
                                    logSuccess("setRemoteDescription"),
                                    logFail("setRemoteDescription"));
    } else if (this._pc.localDescription && this._pc.remoteDescription &&
        this._pc.localDescription.type == "answer") {
      this._pc.setRemoteDescription(this._pc.remoteDescription,
                                    logSuccess("setRemoteDescription"),
                                    logFail("setRemoteDescription"));
      this._pc.setLocalDescription(this._pc.localDescription,
                                   logSuccess("setLocalDescription"),
                                   logFail("setLocalDescription"));
    }
    return;
  }
  this.negotiateConnection();
};

SimpleDataPeer.prototype._onIceCallback = function (event) {
  if (event.candidate) {
    // Send IceCandidate to peer.
    // trace.log(this.peerName + ": " + "ice callback with candidate", event);
    if (this._sendSignalMessage) {
      this._sendSignalMessage(JSON.stringify({'candidate': event.candidate}));
    } else {
      trace.warn(this.peerName + ": " + "_onDescription: _sendSignalMessage is not set.");
    }
  }
};

//-----------------------------------------------------------------------------
// Smart wrapper for a data channels, including real notion of open an queuing
//-----------------------------------------------------------------------------
// Stores state of a datachannel. The issue is that even when a data channel is
// in state open, unless the other end is also open, sent messages may not be
// receieved. To ensure that sent messages are recieved, we send an initial ping
// - pong message and consider the chanel truly open once we get or send a pong
// message.
//
// TODO: remove PingPong; it's complex and shouldn't be needed. Also note that
// combined with the bad channel name sending bug, this will have problems if
// the channel name is PING or PONG. Note: using \b (backspace) to make it
// unlikely that a channel name will clash.
var PingPongMessage =  {
  PING: '\bping',
  PONG : '\bpong'
};

var SmartDataChannelState =  {
  PENDING : 'pending', // waiting for channel to open.
  PINGED : 'pinged',  // I got a ping (and sent a pong)
  PONGED : 'ponged',  // I never got a ping message, but I got a pong.
  CONNECTED: 'connected',  // Have got both a ping and a pong from the peer.
  CLOSED : 'closed' // channel was closed.
};

function SmartDataChannel(channel, peerName, callbacks) {
  this.peerName = peerName;
  this.dataChannel = channel;
  this.state = SmartDataChannelState.PENDING;
  // queue of messages to send when the channel is ready.
  this.queue = [];

  // These are the DataPeer-level callbacks. They provide some abstraction over
  // underlying datachannels and peer connection. e.g. onOpen is called at the
  // point when sending messages will actualy work.
  this._callbacks = {
    // onOpenFn is called at the point messages will actually get through.
    onOpenFn: function (smartDataChannel) {
/*      trace.log(smartDataChannel.peerName + ": dataChannel(" +
        smartDataChannel.dataChannel.label +
        "): onOpenFn"); */
    },
    onCloseFn: function (smartDataChannel) {
/*      trace.log(smartDataChannel.peerName + ": dataChannel(" +
        smartDataChannel.dataChannel.label +
        "): onCloseFn"); */
    },
    // Default on real message prints it to console.
    onMessageFn: function (smartDataChannel, event) {
/*      trace.log(smartDataChannel.peerName + ": dataChannel(" +
          smartDataChannel.dataChannel.label +
          "): onMessageFn", event); */
    },
    // Default on error, prints it.
    onErrorFn: function(smartDataChannel, err) {
      trace.error(smartDataChannel.peerName + ": dataChannel(" +
          smartDataChannel.dataChannel.label + "): error: ", err);
    }
  };
  for(var cb_key in callbacks) {
    // Let the programmer know that a bad (unusable) callback key exists.
    if(!(cb_key in this._callbacks)) {
      trace.log(this.peerName + ": Bad callback specified: " + cb_key +
          ". Being ignored.");
    } else { this._callbacks[cb_key] = callbacks[cb_key]; }
  }

  // This is a local binding for the ping-pong protocol handling of messages so
  // that it can be removed from the event listeners later.
  this._onPingPongMessageFn = this._onPingPongMessage.bind(this);

  // The handlers for the underlying data channel events. _startPingPong will
  // set the 'message' handler.
  channel.addEventListener("open", this._startPingPong.bind(this));
  channel.addEventListener("close", this._onClose.bind(this));
  channel.addEventListener("error", this._onError.bind(this));
}

SmartDataChannel.prototype._startPingPong = function () {
  this.dataChannel.addEventListener("message", this._onPingPongMessageFn);
/*  trace.log(this.peerName + ": dataChannel(" + this.dataChannel.label +
      "): Sending PING"); */
  this.dataChannel.send(PingPongMessage.PING);
};

// This logic is complex. :(  TODO: this should not be needed; when a data
// channel is open, this should guarentee that the message will get to the other
// side. See issue: https://code.google.com/p/webrtc/issues/detail?id=2406&thanks=2406&ts=1379699312
SmartDataChannel.prototype._onPingPongMessage = function (event) {
/*  trace.log(this.peerName + ": dataChannel(" + this.dataChannel.label +
      "): Message during PingPong startup: ", event); */
  if (event.data == PingPongMessage.PING) {
    if (this.state == SmartDataChannelState.PONGED) {
      this._onConnected();
    } else if (this.state == SmartDataChannelState.PENDING) {
      this.dataChannel.send(PingPongMessage.PONG);
      this.state = SmartDataChannelState.PINGED;
    } else {
      trace.log(this.peerName + ": dataChannel(" +
          this.dataChannel.label +
          "): unkown state for message: " + this.state);
    }
  } else if (event.data == PingPongMessage.PONG) {
    if (this.state == SmartDataChannelState.PINGED) {
      this._onConnected();
    } else if (this.state == SmartDataChannelState.PENDING) {
      this.dataChannel.send(PingPongMessage.PONG);
      this._onConnected();
    } else {
      trace.error(this.peerName + ": dataChannel(" +
          this.dataChannel.label +
          "): unkown state for message: " + this.state);
    }
  } else {
    // Sometimes we get messages with a channel id when a channel starts up. I
    // think this is a bug:
    //   https://code.google.com/p/webrtc/issues/detail?id=2439
    // TODO: When that bug is fixed, add a warning here.
  }
};

SmartDataChannel.prototype._onError = function (e) {
  this._callbacks(this,e);
};

SmartDataChannel.prototype._onConnected = function () {
  /*trace.log(this.peerName + ": dataChannel(" + this.dataChannel.label +
      "): CONNECTED", event); */
  this.state = SmartDataChannelState.CONNECTED;
  this.dataChannel.removeEventListener("message", this._onPingPongMessageFn);
  this.dataChannel.addEventListener("message", this._onMessage.bind(this));
  this._callbacks.onOpenFn(this);
  this._sendQueuedMessages();
};

SmartDataChannel.prototype._sendQueuedMessages = function () {
  while(this.queue.length > 0) { this.dataChannel.send(this.queue.shift()); }
};

SmartDataChannel.prototype._onMessage = function (event) {
  this._callbacks.onMessageFn(this, event);
};

SmartDataChannel.prototype._onClose = function () {
  this.close();
};

// Given an ArrayBuffer, a string, or a Blob, send it on the underlying data
// channel. If not connected, queues the message and sends it when connected.
SmartDataChannel.prototype.send = function (message) {
  if (this.state == SmartDataChannelState.CONNECTED) {
    this.dataChannel.send(message);
  } else {
    this.queue.push(message);
  }
};

SmartDataChannel.prototype.close = function () {
  if(this.dataChannel.readyState != "closed") {
    this.dataChannel.close();
  }
  this.state = SmartDataChannelState.CLOSED;
  this._callbacks.onCloseFn(this);
};

//-----------------------------------------------------------------------------
// A nicer wrapper for P2P data channels that uses SmartDataChannel and
// datachannel labels to provide a simpler interface that abstracts over all
// the channel negotiation stuff.
//-----------------------------------------------------------------------------
// A smart wrapper for data channels that queues messages.
// this._dataChannelCallbacks : {
//   onOpenFn: function (smartDataChannel) {...},
//   onCloseFn: function (smartDataChannel) {...},
//   onMessageFn: function (smartDataChannel, event) {...},
//   onErrorFn: function (smartDataChannel, error) {...},
// };
function DataPeer(peerName, dataChannelCallbacks) {
  this.peerName = peerName;
  this._simplePeer = new SimpleDataPeer(this.peerName);
  // All channels created and in this peer connection.
  this._smartChannels = {};
  // These are the DataPeer-level callbacks. They provide some abstraction over
  // underlying datachannels and peer connection. e.g. onOpen is called at the
  // point when sending messages will actualy work.
  this._dataChannelCallbacks = dataChannelCallbacks;
  this._simplePeer.runWhenReady(function() {
    this._pc = this._simplePeer._pc;
    this._pc.addEventListener("datachannel", this._onDataChannel.bind(this));
  }.bind(this));
}

DataPeer.prototype.setSendSignalMessage = function (sendSignalMessageFn) {
  this._simplePeer.setSendSignalMessage(sendSignalMessageFn);
};

// Called when a peer has opened up a data channel to us.
DataPeer.prototype._onDataChannel = function (event) {
  this._smartChannels[event.channel.label] =
      new SmartDataChannel(event.channel, this.peerName,
          this._dataChannelCallbacks);
};

// Called to establish a new data channel with our peer.
DataPeer.prototype.openDataChannel = function (channelId, continuation) {
  this._simplePeer.runWhenReady(function() {
    this._smartChannels[channelId] =
        new SmartDataChannel(this._pc.createDataChannel(channelId, {}),
                             this.peerName, this._dataChannelCallbacks);
    continuation();
  }.bind(this));
};

// If channel doesn't already exist, start a new channel.
DataPeer.prototype.send = function (channelId, message, continuation) {
  if(!(channelId in this._smartChannels)) {
    this.openDataChannel(channelId, function() {
      this.send(channelId, message, continuation); }.bind(this));
  } else {
    this._smartChannels[channelId].send(message);
    continuation();
  }
};

DataPeer.prototype.closeChannel = function (channelId) {
  if(!(channelId in this._smartChannels)) {
//    trace.warn(this.peerName + ": " + "Trying to close a data channel id (" + channelId + ") that does not exist.");
    return;
  }
  this._smartChannels[channelId].close();
  delete this._smartChannels[channelId];
};

DataPeer.prototype.close = function () {
  for(var channelId in this._smartChannels) {
    this.closeChannel(channelId);
  }
//  trace.log(this.peerName + ": " + "Closed DataPeer.");
  this._pc.close();
};

DataPeer.prototype.handleSignalMessage = function (message) {
  this._simplePeer.handleSignalMessage(message);
};

// Export to the environment
exports.DataPeer = DataPeer;
}(window));
/**
 * @license tbd - something open.
 * see: https://github.com/UWNetworksLab/freedom
 */
(function (global) {
  'use strict';
  (function freedom() {
    /* jshint -W069 */

    var freedom_src = '(function (global) {\'use strict\';(' + freedom + ')();})(this);';
    var setup, fdom;

    if (typeof global['freedom'] !== 'undefined') {
      return;
    }
/*globals fdom:true, handleEvents, mixin, eachProp */
/*jslint indent:2,white:true,node:true,sloppy:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}

/**
 * The API registry for FreeDOM.  Used to look up requested APIs,
 * and provides a bridge for core APIs to act like normal APIs.
 * @Class API
 * @constructor
 */
var Api = function() {
  this.apis = {};
  this.providers = {};
  this.waiters = {};
};

/**
 * Get an API.
 * @method get
 * @param {String} api The API name to get.
 * @returns {{name:String, definition:API}} The API if registered.
 */
Api.prototype.get = function(api) {
  if (!this.apis[api]) {
    return false;
  }
  return {
    name: api,
    definition: this.apis[api]
  };
};

/**
 * Set an API to a definition.
 * @method set
 * @param {String} name The API name.
 * @param {API} definition The JSON object defining the API.
 */
Api.prototype.set = function(name, definition) {
  this.apis[name] = definition;
};

/**
 * Register a core API provider.
 * @method register
 * @param {String} name the API name.
 * @param {Function} constructor the function to create a provider for the API.
 */
Api.prototype.register = function(name, constructor) {
  var i;

  this.providers[name] = constructor;

  if (this.waiters[name]) {
    for (i = 0; i < this.waiters[name].length; i += 1) {
      this.waiters[name][i][0].resolve(constructor.bind({},
          this.waiters[name][i][1]));
    }
    delete this.waiters[name];
  }
};

/**
 * Get a core API connected to a given FreeDOM module.
 * @method getCore
 * @param {String} name the API to retrieve.
 * @param {port.App} from The instantiating App.
 * @returns {fdom.proxy.Deferred} A promise of a fdom.App look-alike matching
 * a local API definition.
 */
Api.prototype.getCore = function(name, from) {
  var deferred = fdom.proxy.Deferred();
  if (this.apis[name]) {
    if (this.providers[name]) {
      deferred.resolve(this.providers[name].bind({}, from));
    } else {
      if (!this.waiters[name]) {
        this.waiters[name] = [];
      }
      this.waiters[name].push([deferred, from]);
    }
  } else {
    fdom.debug.warn('Api.getCore asked for unknown core: ' + name);
    deferred.reject();
  }
  return deferred.promise();
};

/**
 * Defines fdom.apis for fdom module registry and core provider registation.
 */
fdom.apis = new Api();
/**
 * @module freedom
 */

/**
 * External freedom Setup.  global.freedom is set to the value returned by
 * setup (see preamble.js and postamble.js for that mechanism).  As a result,
 * this is the primary entry function for the freedom library.
 * @for util
 * @method setup
 * @param {Object} global The window / frame / worker context freedom is in.
 * @param {String} freedom_src The textual code of freedom, for replication.
 * @param {Object} config Overriding config for freedom.js
 * @static
 */
setup = function (global, freedom_src, config) {
  fdom.debug = new fdom.port.Debug();

  var hub = new fdom.Hub(),
      site_cfg = {
        'debug': true,
        'stayLocal': false,
        'portType': 'Worker'
      },
      manager = new fdom.port.Manager(hub),
      external = new fdom.port.Proxy(fdom.proxy.EventInterface),
      setupApp = function(app) {
        manager.setup(app);
        manager.createLink(external, 'default', app);
      },
      link;

  manager.setup(external);
  
  if (isAppContext()) {
    site_cfg.global = global;
    site_cfg.src = freedom_src;
    setupApp(new fdom.port[site_cfg.portType]());

    // Delay debug messages until delegation to the parent context is setup.
    manager.once('delegate', manager.setup.bind(manager, fdom.debug));
  } else {
    manager.setup(fdom.debug);
    advertise(config ? config.advertise : undefined);
    
    // Configure against data-manifest.
    if (typeof document !== 'undefined') {
      eachReverse(scripts(), function (script) {
        var manifest = script.getAttribute('data-manifest');
        var source = script.src;
        if (manifest) {
          site_cfg.source = source;
          site_cfg.manifest = manifest;
          if (script.textContent.trim().length) {
            try {
              mixin(site_cfg, JSON.parse(script.textContent), true);
            } catch (e) {
              fdom.debug.warn("Failed to parse configuration: " + e);
            }
          }
          return true;
        }
      });
    }

    site_cfg.global = global;
    site_cfg.src = freedom_src;
    site_cfg.resources = fdom.resources;
    if(config) {
      mixin(site_cfg, config, true);
    }

    //Try to talk to local FreeDOM Manager
    if (!site_cfg['stayLocal']) {
      link = new fdom.port.Runtime();
      manager.setup(link);
    }

    link = location.protocol + "//" + location.host + location.pathname;
    fdom.resources.get(link, site_cfg.manifest).done(function(url) {
      setupApp(new fdom.port.App(url, []));
    });
  }
  hub.emit('config', site_cfg);

  // Enable console.log from worker contexts.
  if (typeof global.console === 'undefined') {
    global.console = fdom.debug;
  }
  
  return external.getInterface();
};
/*globals fdom:true, handleEvents, mixin, eachProp, XMLHttpRequest */
/*jslint indent:2,white:true,node:true,sloppy:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}

/**
 * Defines fdom.Hub, the core message hub between freedom modules.
 * Incomming messages from apps are sent to hub.onMessage()
 * @class Hub
 * @constructor
 */
fdom.Hub = function() {
  this.route = Math.round(Math.random() * 1000000);
  this.config = {};
  this.apps = {};
  this.routes = {};
  this.unbound = [];

  handleEvents(this);
  this.on('config', function(config) {
    mixin(this.config, config);
  }.bind(this));
};

/**
 * Handle an incoming message from a freedom app.
 * @method onMessage
 * @param {String} source The identifiying source of the message.
 * @param {Object} message The sent message.
 */
fdom.Hub.prototype.onMessage = function(source, message) {
  var destination = this.routes[source];
  if (!destination || !destination.app) {
    fdom.debug.warn("Message dropped from unregistered source " + source);
    return;
  }

  if(!this.apps[destination.app]) {
    fdom.debug.warn("Message dropped to deregistered destination " + destination.app);
    return;
  }

  if (!message.quiet) {
    fdom.debug.log(this.apps[destination.source].toString() +
        " -" + message.type + "-> " +
        this.apps[destination.app].toString() + "." + destination.flow);
  }

  this.apps[destination.app].onMessage(destination.flow, message);
};

/**
 * Get the local destination port of a flow.
 * @method getDestination
 * @param {String} source The flow to retrieve.
 * @return {Port} The destination port.
 */
fdom.Hub.prototype.getDestination = function(source) {
  var destination = this.routes[source];
  if (!destination) {
    return null;
  }
  return this.apps[destination.app];
};

/**
 * Register a destination for messages with this hub.
 * @method register
 * @param {Port} app The Port to register.
 * @param {Boolean} [force] Whether to override an existing port.
 * @return {Boolean} Whether the app was registered.
 */
fdom.Hub.prototype.register = function(app, force) {
  if (!this.apps[app.id] || force) {
    this.apps[app.id] = app;
    return true;
  } else {
    return false;
  }
};

/**
 * Deregister a destination for messages with the hub.
 * Note: does not remove associated routes. As such, deregistering will
 * prevent the installation of new routes, but will not distrupt existing
 * hub routes.
 * @method deregister
 * @param {Port} app The Port to deregister
 * @return {Boolean} Whether the app was deregistered.
 */
fdom.Hub.prototype.deregister = function(app) {
  if(!this.apps[app.id]) {
    return false;
  }
  delete this.apps[app.id];
  return true;
};

/**
 * Install a new route in the hub.
 * @method install
 * @param {Port} source The source of the route.
 * @param {Port} destination The destination of the route.
 * @param {String} flow The flow on which the destination will receive routed messages.
 * @return {String} A routing source identifier for sending messages.
 */
fdom.Hub.prototype.install = function(source, destination, flow) {
  if (!source) {
    fdom.debug.warn("Unable to install route for null source");
    return;
  }
  if (!this.apps[source.id]) {
    fdom.debug.warn("Unwilling to generate a source for " + source.id);
    return;
  } else {
    source = this.apps[source.id];
  }
  if (!destination) {
    fdom.debug.warn("Unwilling to generate a flow to nowhere from " + source.id);
    return;
  }

  var route = this.generateRoute();
  this.routes[route] = {
    app: destination,
    flow: flow,
    source: source.id
  };
  if (typeof source.on === 'function') {
    source.on(route, this.onMessage.bind(this, route));
  }

  return route;
};

/**
 * Uninstall a hub route.
 * @method uninstall
 * @param {Port} source The source of the route.
 * @param {String} flow The route to uninstall.
 * @return {Boolean} Whether the route was able to be uninstalled.
 */
fdom.Hub.prototype.uninstall = function(source, flow) {
  if (!this.apps[source.id]) {
    fdom.debug.warn("Unable to find routes for unknown source " + source.id);
    return false;
  } else {
    source = this.apps[source.id];
  }
  var route = this.routes[flow];
  if (!route) {
    return false;
  } else if (route.source !== source.id) {
    fdom.debug.warn("Flow " + flow + " does not belong to port " + source.id);
    return false;
  }

  delete this.routes[flow];
  if (typeof source.off === 'function') {
    source.off(route);
  }
  return true;
};

/**
 * Generate a unique routing identifier.
 * @method generateRoute
 * @return {String} a routing source identifier.
 * @private
 */
fdom.Hub.prototype.generateRoute = function() {
  return (this.route += 1);
};
/*globals fdom:true, handleEvents, mixin, eachProp */
/*jslint indent:2,white:true,node:true,sloppy:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}
fdom.port = fdom.port || {};

/**
 * The external Port face of an application on a hub.
 * @class App
 * @extends Port
 * @param {String} manifestURL The manifest this module loads.
 * @param {String[]} creator The lineage of creation for this module.
 * @constructor
 */
fdom.port.App = function(manifestURL, creator) {
  this.config = {};
  this.id = manifestURL + Math.random();
  this.manifestId = manifestURL;
  this.lineage = [this.manifestId].concat(creator);
  this.loadManifest();
  this.externalPortMap = {};
  this.internalPortMap = {};
  this.started = false;

  handleEvents(this);
};

/**
 * Receive an external application for the Application.
 * @method onMessage
 * @param {String} flow The origin of the message.
 * @param {Object} message The message received.
 */
fdom.port.App.prototype.onMessage = function(flow, message) {
  if (flow === 'control') {
    if (message.type === 'setup') {
      this.controlChannel = message.channel;
      mixin(this.config, message.config);
      this.emit(this.controlChannel, {
        type: 'Core Provider',
        request: 'core'
      });
      this.start();
      return;
    } else if (message.type === 'createLink' && message.channel) {
      this.externalPortMap[message.name] = message.channel;
      if (this.internalPortMap[message.name] === undefined) {
        this.internalPortMap[message.name] = false;
      }
      this.emit(message.channel, {
        type: 'default channel announcement',
        channel: message.reverse
      });
      return;
    } else if (message.core) {
      this.core = new message.core();
      this.emit('core', message.core);
      return;
    } else if (message.type === 'close') {
      // Closing channel.
      if (message.channel === 'default' || message.channel === 'control') {
        this.stop();
      }
      this.deregisterFlow(message.channel, false);
    } else {
      this.port.onMessage(flow, message);
    }
  } else {
    if (this.externalPortMap[flow] === false && message.channel) {
      //console.log('handling channel announcement for ' + flow);
      this.externalPortMap[flow] = message.channel;
      if (this.internalPortMap[flow] === undefined) {
        this.internalPortMap[flow] = false;
      }
      if (this.manifest.provides && flow === 'default') {
        this.externalPortMap[this.manifest.provides[0]] = message.channel;
      }
      return;
    } else if (!this.started) {
      this.once('start', this.onMessage.bind(this, flow, message));
    } else {
      if (this.internalPortMap[flow] === false) {
        this.once('internalChannelReady', this.onMessage.bind(this, flow, message));
      } else {
        this.port.onMessage(this.internalPortMap[flow], message);
      }
    }
  }
};

/**
 * Clean up after a flow which is no longer used / needed.
 * @method deregisterFLow
 * @param {String} flow The flow to remove mappings for.
 * @param {Boolean} internal If the flow name is the internal identifier.
 * @returns {Boolean} Whether the flow was successfully deregistered.
 * @private
 */
fdom.port.App.prototype.deregisterFlow = function(flow, internal) {
  var key,
      map = internal ? this.internalPortMap : this.externalPortMap;
  // TODO: this is inefficient, but seems less confusing than a 3rd
  // reverse lookup map.
  for (key in map) {
    if (map[key] === flow) {
      if (internal) {
        this.emit(this.controlChannel, {
          type: 'Channel Teardown',
          request: 'unlink',
          to: this.externalPortMap[key]
        });
      } else {
        this.port.onMessage(flow, {
          type: 'close',
          channel: this.internalPortMap[key]
        });
      }
      delete this.externalPortMap[key];
      delete this.internalPortMap[key];
      return true;
    }
  }
  return false;
};

/**
 * Attempt to start the application once the remote freedom context
 * exists.
 * @method start
 * @private
 */
fdom.port.App.prototype.start = function() {
  if (this.started || this.port) {
    return false;
  }
  if (this.manifest && this.controlChannel) {
    this.loadLinks();
    this.port = new fdom.port[this.config.portType](this);
    // Listen to all port messages.
    this.port.on(this.emitMessage.bind(this));
    // Tell the local port to ask us for help.
    this.port.onMessage('control', {
      channel: 'control',
      config: this.config
    });

    // Tell the remote location to delegate debugging.
    this.port.onMessage('control', {
      type: 'Redirect',
      request: 'delegate',
      flow: 'debug'
    });
    this.port.onMessage('control', {
      type: 'Redirect',
      request: 'delegate',
      flow: 'core'
    });
    
    // Tell the remote location to instantate the app.
    this.port.onMessage('control', {
      type: 'Environment Configuration',
      request: 'port',
      name: 'AppInternal',
      service: 'AppInternal',
      exposeManager: true
    });
  }
};

/**
 * Stop the application when it is no longer needed, and tear-down state.
 * @method stop
 * @private
 */
fdom.port.App.prototype.stop = function() {
  if (!this.started) {
    return;
  }
  if (this.port) {
    this.port.off();
    this.port.onMessage('control', {
      type: 'close',
      channel: 'control'
    });
    delete this.port;
  }
  this.started = false;
};

/**
 * Textual Description of the Port
 * @method toString
 * @return {String} The description of this Port.
 */
fdom.port.App.prototype.toString = function() {
  return "[App " + this.manifestId + "]";
};

/**
 * Intercept messages as they arrive from the application,
 * mapping them between internal and external flow names.
 * @method emitMessage
 * @param {String} name The destination the app wants to send to.
 * @param {Object} message The message to send.
 * @private
 */
fdom.port.App.prototype.emitMessage = function(name, message) {
  if (this.internalPortMap[name] === false && message.channel) {
    fdom.debug.log('Application saw new channel binding: ' + name +
        'registered as ' + message.channel);
    this.internalPortMap[name] = message.channel;
    this.emit('internalChannelReady');
    return;
  }
  // Terminate debug redirection requested in start().
  if (name === 'control') {
    if (message.flow === 'debug' && message.message) {
      fdom.debug.format(message.message.severity,
          this.toString(),
          message.message.msg);
    } else if (message.flow === 'core' && message.message) {
      if (!this.core) {
        this.once('core', this.emitMessage.bind(this, name, message));
        return;
      }
      if (message.message.type === 'register') {
        message.message.reply = this.port.onMessage.bind(this.port, 'control');
        this.externalPortMap[message.message.id] = false;
      }
      this.core.onMessage(this, message.message);
    } else if (message.name === 'AppInternal' && !this.appInternal) {
      this.appInternal = message.channel;
      this.port.onMessage(this.appInternal, {
        type: 'Initialization',
        id: this.manifestId,
        appId: this.id,
        manifest: this.manifest,
        lineage: this.lineage,
        channel: message.reverse
      });
    } else if (message.type === 'createLink') {
      // A design decision was that the default channel is
      // overridden when acting as a provider.
      if (this.manifest.provides &&
          this.manifest.provides.indexOf(message.name) === 0) {
        this.internalPortMap['default'] = message.channel;
      }

      this.internalPortMap[message.name] = message.channel;
      this.port.onMessage(message.channel, {
        type: 'channel announcement',
        channel: message.reverse
      });
      this.emit('internalChannelReady');
    } else if (message.type === 'close') {
      this.deregisterFlow(message.channel, true);
    }
  } else if (name === 'AppInternal' && message.type === 'ready' && !this.started) {
    this.started = true;
    this.emit('start');
  } else if (name === 'AppInternal' && message.type === 'resolve') {
    fdom.resources.get(this.manifestId, message.data).done(function(id, data) {
      this.port.onMessage(this.appInternal, {
        type: 'resolve response',
        id: id,
        data: data
      });
    }.bind(this, message.id));
  } else {
    this.emit(this.externalPortMap[name], message);
  }
  return false;
};

/**
 * Load the module description from its manifest.
 * @method loadManifest
 * @private
 */
fdom.port.App.prototype.loadManifest = function() {
  fdom.resources.getContents(this.manifestId).done(function(data) {
    var resp = {};
    try {
      resp = JSON.parse(data);
    } catch(err) {
      fdom.debug.warn("Failed to load " + this.manifestId + ": " + err);
      return;
    }
    this.manifest = resp;
    this.start();
  }.bind(this));
};

/**
 * Request the external routes used by this application.
 * @method loadLinks
 * @private
 */
fdom.port.App.prototype.loadLinks = function() {
  var i, channels = ['default'], name, dep,
      finishLink = function(dep, provider) {
        dep.getInterface().provideAsynchronous(provider);
      };
  if (this.manifest.permissions) {
    for (i = 0; i < this.manifest.permissions.length; i += 1) {
      name = this.manifest.permissions[i];
      if (channels.indexOf(name) < 0 && name.indexOf('core.') === 0) {
        channels.push(name);
        dep = new fdom.port.Provider(fdom.apis.get(name).definition);
        fdom.apis.getCore(name, this).done(finishLink.bind(this, dep));

        this.emit(this.controlChannel, {
          type: 'Link to ' + name,
          request: 'link',
          name: name,
          to: dep
        });
      }
    }
  }
  if (this.manifest.dependencies) {
    eachProp(this.manifest.dependencies, function(desc, name) {
      if (channels.indexOf(name) < 0) {
        channels.push(name);
      }
      fdom.resources.get(this.manifestId, desc.url).done(function (url) {
        var dep = new fdom.port.App(url, this.lineage);
        this.emit(this.controlChannel, {
          type: 'Link to ' + name,
          request: 'link',
          name: name,
          to: dep
        });
      }.bind(this));
    }.bind(this));
  }
  // Note that messages can be synchronous, so some ports may already be bound.
  for (i = 0; i < channels.length; i += 1) {
    this.externalPortMap[channels[i]] = this.externalPortMap[channels[i]] || false;
    this.internalPortMap[channels[i]] = false;
  }
};

fdom.port.App.prototype.serialize = function() {
  return JSON.serialize({
    manifestId: this.manifestId,
    externalPortMap: this.externalPortMap,
    internalPortMap: this.internalPortMap,
    manifest: this.manifest,
    controlChannel: this.controlChannel
  });
};
/*globals fdom:true, handleEvents, mixin, eachProp */
/*jslint indent:2,white:true,node:true,sloppy:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}
fdom.port = fdom.port || {};

/**
 * The internal configuration of an application, makes sure that the freedom
 * export has the appropriate properties, and loads user scripts.
 * @class AppInternal
 * @extends Port
 * @param {Port} manager The hub manager within this application to signal.
 * @constructor
 */
fdom.port.AppInternal = function(manager) {
  this.config = {};
  this.manager = manager;
  
  this.id = 'environment' + Math.random();
  this.pendingPorts = 0;
  this.requests = {};

  handleEvents(this);
};

/**
 * Message handler for this port.
 * The Internal app only handles two messages:
 * The first is its setup from the manager, which it uses for configuration.
 * The second is from the app external, which provides it with manifest info.
 * @method onMessage
 * @param {String} flow The detination of the message.
 * @param {Object} message The message.
 */
fdom.port.AppInternal.prototype.onMessage = function(flow, message) {
  if (flow === 'control') {
    if (!this.controlChannel && message.channel) {
      this.controlChannel = message.channel;
      mixin(this.config, message.config);
    }
  } else if (flow === 'default' && !this.appId) {
    // Recover the app:
    this.port = this.manager.hub.getDestination(message.channel);
    this.appChannel = message.channel;
    this.appId = message.appId;
    this.appLineage = message.lineage;

    var objects = this.mapProxies(message.manifest);

    this.once('start', this.loadScripts.bind(this, message.id, 
        message.manifest.app.script));
    this.loadLinks(objects);
  } else if (flow === 'default' && this.requests[message.id]) {
    this.requests[message.id].resolve(message.data);
  }
};

/**
 * Get a textual description of this Port.
 * @method toString
 * @return {String} a description of this Port.
 */
fdom.port.AppInternal.prototype.toString = function() {
  return "[App Environment Helper]";
};

/**
 * Attach a proxy to the externally visible namespace.
 * @method attach
 * @param {String} name The name of the proxy.
 * @param {Proxy} proxy The proxy to attach.
 * @private.
 */
fdom.port.AppInternal.prototype.attach = function(name, proxy) {
  var exp = this.config.global.freedom;

  if (!exp[name]) {
    exp[name] = proxy.getProxyInterface();
  }

  this.pendingPorts -= 1;
  if (this.pendingPorts === 0) {
    this.emit('start');
  }
};

/**
 * Request a set of proxy interfaces, and bind them to the external
 * namespace.
 * @method loadLinks
 * @param {Object[]} items Descriptors of the proxy ports to load.
 * @private
 */
fdom.port.AppInternal.prototype.loadLinks = function(items) {
  var i, proxy, provider, core;
  for (i = 0; i < items.length; i += 1) {
    if (items[i].def) {
      if (items[i].provides) {
        proxy = new fdom.port.Provider(items[i].def);
      } else {
        proxy = new fdom.port.Proxy(fdom.proxy.ApiInterface.bind({}, items[i].def));
      }
    } else {
      proxy = new fdom.port.Proxy(fdom.proxy.EventInterface);
    }
    
    this.manager.createLink(this.port, items[i].name, proxy);
    this.pendingPorts += 1;
    proxy.once('start', this.attach.bind(this, items[i].name, proxy));
  }
  
  // Allow resolution of files by parent.
  fdom.resources.addResolver(function(manifest, url, deferred) {
    var id = Math.random();
    this.emit(this.appChannel, {
      type: 'resolve',
      id: id,
      data: url
    });
    this.requests[id] = deferred;
    return true;
  }.bind(this));

  // Attach Core.
  this.pendingPorts += 1;

  core = fdom.apis.get('core').definition;
  provider = new fdom.port.Provider(core);
  this.manager.getCore(function(CoreProv) {
    new CoreProv(this.manager).setId(this.appLineage);
    provider.getInterface().provideAsynchronous(CoreProv);
  }.bind(this));

  this.emit(this.controlChannel, {
    type: 'Link to core',
    request: 'link',
    name: 'core',
    to: provider
  });

  proxy = new fdom.port.Proxy(fdom.proxy.ApiInterface.bind({}, core));
  this.manager.createLink(provider, 'default', proxy);
  this.attach('core', proxy);

  if (this.pendingPorts === 0) {
    this.emit('start');
  }
};

/**
 * Determine which proxy ports should be exposed by this application.
 * @method mapProxies
 * @param {Object} manifest the application JSON manifest.
 * @return {Object[]} proxy descriptors defined in the manifest.
 */
fdom.port.AppInternal.prototype.mapProxies = function(manifest) {
  var proxies = [], seen = ['core'], i, obj;
  
  if (manifest.permissions) {
    for (i = 0; i < manifest.permissions.length; i += 1) {
      obj = {
        name: manifest.permissions[i],
        def: undefined
      };
      obj.def = fdom.apis.get(obj.name).definition;
      if (seen.indexOf(obj.name) < 0 && obj.def) {
        proxies.push(obj);
        seen.push(obj.name);
      }
    }
  }
  
  if (manifest.dependencies) {
    eachProp(manifest.dependencies, function(desc, name) {
      obj = {
        name: name
      };
      if (seen.indexOf(name) < 0) {
        if (desc.api) {
          obj.def = fdom.apis.get(desc.api).definition;
        }
        proxies.push(obj);
        seen.push(name);
      }
    });
  }
  
  if (manifest.provides) {
    for (i = 0; i < manifest.provides.length; i += 1) {
      obj = {
        name: manifest.provides[i],
        def: undefined,
        provides: true
      };
      obj.def = fdom.apis.get(obj.name).definition;
      if (seen.indexOf(obj.name) < 0 && obj.def) {
        proxies.push(obj);
        seen.push(obj.name);
      }
    }
  }

  return proxies;
};

/**
 * Load external scripts into this namespace.
 * @method loadScripts
 * @param {String} from The URL of this application's manifest.
 * @param {String[]} scripts The URLs of the scripts to load.
 */
fdom.port.AppInternal.prototype.loadScripts = function(from, scripts) {
  var i = 0,
      safe = true,
      importer = function importScripts(script, deferred) {
        this.config.global.importScripts(script);
        deferred.resolve();
      }.bind(this),
      urls = [],
      outstanding = 0,
      load = function(url) {
        urls.push(url);
        outstanding -= 1;
        if (outstanding === 0) {
          if (safe) {
            this.emit(this.appChannel, {
              type: 'ready'
            });
            this.tryLoad(importer, urls);
          } else {
            this.tryLoad(importer, urls).done(function() {
              this.emit(this.appChannel, {
                type: 'ready'
              });
            }.bind(this));
          }
        }
      }.bind(this);

  if (!this.config.global.importScripts) {
    safe = false;
    importer = function(url, deferred) {
      var script = this.config.global.document.createElement('script');
      script.src = url;
      script.addEventListener('load', deferred.resolve.bind(deferred), true);
      this.config.global.document.body.appendChild(script);
    }.bind(this);
  }

  if (typeof scripts === 'string') {
    outstanding = 1;
    fdom.resources.get(from, scripts).done(load);
  } else {
    outstanding = scripts.length;
    for (i = 0; i < scripts.length; i += 1) {
      fdom.resources.get(from, scripts[i]).done(load);
    }
  }
};

/**
 * Attempt to load resolved scripts into the namespace.
 * @method tryLoad
 * @private
 * @param {Function} importer The actual import function
 * @param {String[]} urls The resoved URLs to load.
 * @returns {fdom.proxy.Deferred} completion of load
 */
fdom.port.AppInternal.prototype.tryLoad = function(importer, urls) {
  var i,
      deferred = fdom.proxy.Deferred(),
      def,
      left = urls.length,
      finished = function() {
        left -= 1;
        if (left === 0) {
          deferred.resolve();
        }
      };
  try {
    for (i = 0; i < urls.length; i += 1) {
      def = fdom.proxy.Deferred();
      def.done(finished);
      importer(urls[i], def);
    }
  } catch(e) {
    fdom.debug.warn(e.stack);
    fdom.debug.error("Error loading " + urls[i], e);
    fdom.debug.error("If the stack trace is not useful, see https://" +
        "github.com/UWNetworksLab/freedom/wiki/Debugging-Script-Parse-Errors");
  }
  return deferred.promise();
};
/*globals fdom:true, handleEvents */
/*jslint indent:2, white:true, node:true, sloppy:true, browser:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}
fdom.port = fdom.port || {};

/**
 * A freedom port providing debugging output to the console.
 * @uses handleEvents
 * @extends Port
 * @constructor
 */
fdom.port.Debug = function() {
  this.id = 'debug';
  this.emitChannel = false;
  this.console = null;
  this.config = false;
  handleEvents(this);
};

/**
 * Provide a textual description of this port.
 * @method toString
 * @return {String} the textual description.
 */
fdom.port.Debug.prototype.toString = function() {
  return '[Console]';
};

/**
 * Handler for receiving messages sent to the debug port.
 * These messages are used to retreive config for exposing console.
 * @method onMessage
 * @param {String} source the source identifier for the message.
 * @param {Object} message the received message.
 */
fdom.port.Debug.prototype.onMessage = function(source, message) {
  if (source === 'control' && message.channel && !this.emitChannel) {
    this.emitChannel = message.channel;
    this.config = message.config.debug;
    this.console = message.config.global.console;
    this.emit('ready');
  }
};

/**
 * Dispatch a debug message with arbitrary severity.
 * @method format
 * @param {String} severity the severity of the message.
 * @param {String} source The location of message.
 * @param {String[]} args The contents of the message.
 * @private
 */
fdom.port.Debug.prototype.format = function(severity, source, args) {
  var i, alist = [];
  if (typeof args === "string") {
    alist.push(args);
  } else {
    for (i = 0; i < args.length; i += 1) {
      alist.push(args[i]);
    }
  }
  if (!this.emitChannel) {
    this.on('ready', this.format.bind(this, severity, source, alist));
    return;
  }
  this.emit(this.emitChannel, {
    severity: severity,
    source: source,
    quiet: true,
    request: 'debug',
    msg: JSON.stringify(alist)
  });
};

/**
 * Print received messages on the console.
 * @method print
 * @param {Object} message The message emitted by {@see format} to print.
 */
fdom.port.Debug.prototype.print = function(message) {
  var debug = Boolean(this.config), args, arr = [], i = 0;
  if (typeof this.config === 'string') {
    debug = false;
    args = this.config.split(' ');
    for (i = 0; i < args.length; i += 1) {
      if (args[i].indexOf('source:') === 0) {
        if (message.source === undefined ||
            message.source.indexOf(args[i].substr(7)) > -1) {
          debug = true;
          break;
        }
      } else {
        if (message.msg.indexOf(args[i]) > -1) {
          debug = true;
          break;
        }
      }
    }
  }
  if (!debug) {
    return;
  }
  if (typeof this.console !== 'undefined' && this.console !== this) {
    args = JSON.parse(message.msg);
    if (typeof args === "string") {
      arr.push(JSON.parse(args));
    } else {
      while (args[i] !== undefined) {
        arr.push(args[i]);
        i += 1;
      }
    }
    if (message.source) {
      arr.unshift(message.source);
    }
    if (!this.console[message.severity] && this.console.log) {
      message.severity = 'log';
    }
    this.console[message.severity].apply(this.console, arr);
  }
};

/**
 * Print a log message to the console.
 * @method log
 */
fdom.port.Debug.prototype.log = function() {
  this.format('log', undefined, arguments);
};

/**
 * Print a warning message to the console.
 * @method warn
 */
fdom.port.Debug.prototype.warn = function() {
  this.format('warn', undefined, arguments);
};

/**
 * Print an error message to the console.
 * @method error
 */
fdom.port.Debug.prototype.error = function() {
  this.format('error', undefined, arguments);
};
/*globals fdom:true, handleEvents, mixin, isAppContext, getBlob, forceAppContext, getURL */
/*jslint indent:2, white:true, node:true, sloppy:true, browser:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}
fdom.port = fdom.port || {};

/**
 * A port providing message transport between two freedom contexts via iFrames.
 * @class Frame
 * @extends Port
 * @uses handleEvents
 * @constructor
 */
fdom.port.Frame = function() {
  this.id = 'Frame ' + Math.random();
  this.config = {};
  this.src = null;

  handleEvents(this);
};

/**
 * Start this port by listening or creating a frame.
 * @method start
 * @private
 */
fdom.port.Frame.prototype.start = function() {
  if (isAppContext()) {
    this.setupListener();
    this.src = 'in';
  } else {
    this.setupFrame();
    this.src = 'out';
  }
};

/**
 * Stop this port by deleting the frame.
 * @method stop
 * @private
 */
fdom.port.Frame.prototype.stop = function() {
  // Function is determined by setupListener or setupFrame as appropriate.
};

/**
 * Get the textual description of this port.
 * @method toString
 * @return {String} the description of this port.
 */
fdom.port.Frame.prototype.toString = function() {
  return "[" + this.id + "]";
};

/**
 * Set up a global listener to handle incoming messages to this
 * freedom.js context.
 * @method setupListener
 */
fdom.port.Frame.prototype.setupListener = function() {
  var onMsg = function(msg) {
    if (msg.data.src !== 'in') {
      this.emitMessage(msg.data.flow, msg.data.message);
    }
  }.bind(this);
  this.obj = this.config.global;
  this.obj.addEventListener('message', onMsg, true);
  this.stop = function() {
    this.obj.removeEventListener('message', onMsg, true);
    delete this.obj;
  };
  this.emit('started');
};

/**
 * Emit messages to the the hub, mapping control channels.
 * @method emitMessage
 * @param {String} flow the flow to emit the message on.
 * @param {Object} messgae The message to emit.
 */
fdom.port.Frame.prototype.emitMessage = function(flow, message) {
  if (flow === 'control' && this.controlChannel) {
    flow = this.controlChannel;
  }
  this.emit(flow, message);
};

/**
 * Set up an iFrame with an isolated freedom.js context inside.
 * @method setupFrame
 */
fdom.port.Frame.prototype.setupFrame = function() {
  var frame, onMsg;
  frame = this.makeFrame(this.config.src, this.config.inject);  
  
  document.documentElement.appendChild(frame);

  onMsg = function(frame, msg) {
    if (!this.obj) {
      this.obj = frame;
      this.emit('started');
    }
    if (msg.data.src !== 'out') {
      this.emitMessage(msg.data.flow, msg.data.message);
    }
  }.bind(this, frame.contentWindow);

  frame.contentWindow.addEventListener('message', onMsg, true);
  this.stop = function() {
    frame.contentWindow.removeEventListener('message', onMsg, true);
    if (this.obj) {
      delete this.obj;
    }
    frame.src = "about:blank";
    document.body.removeChild(frame);
  };
};

/**
 * Make frames to replicate freedom isolation without web-workers.
 * iFrame isolation is non-standardized, and access to the DOM within frames
 * means that they are insecure. However, debugging of webworkers is
 * painful enough that this mode of execution can be valuable for debugging.
 * @method makeFrame
 */
fdom.port.Frame.prototype.makeFrame = function(src, inject) {
  var frame = document.createElement('iframe'),
      extra = '',
      loader,
      blob;
  // TODO(willscott): add sandboxing protection.

  // TODO(willscott): survive name mangling.
  src = src.replace("'portType': 'Worker'", "'portType': 'Frame'");
  if (inject) {
    extra = '<script src="' + inject + '" onerror="' +
      'throw new Error(\'Injection of ' + inject +' Failed!\');' +
      '"></script>';
  }
  loader = '<html>' + extra + '<script src="' +
      forceAppContext(src) + '"></script></html>';
  blob = getBlob(loader, 'text/html');
  frame.src = getURL(blob);

  return frame;
};

/**
 * Receive messages from the hub to this port.
 * Received messages will be emitted from the other side of the port.
 * @method onMessage
 * @param {String} flow the channel/flow of the message.
 * @param {Object} message The Message.
 */
fdom.port.Frame.prototype.onMessage = function(flow, message) {
  if (flow === 'control' && !this.controlChannel) {
    if (!this.controlChannel && message.channel) {
      this.controlChannel = message.channel;
      mixin(this.config, message.config);
      this.start();
    }
  } else {
    if (this.obj) {
      //fdom.debug.log('message sent to worker: ', flow, message);
      this.obj.postMessage({
        src: this.src,
        flow: flow,
        message: message
      }, '*');
    } else {
      this.once('started', this.onMessage.bind(this, flow, message));
    }
  }
};

/*globals fdom:true, handleEvents, mixin */
/*jslint indent:2,white:true,node:true,sloppy:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}
fdom.port = fdom.port || {};

/**
 * A freedom application which processes control messages manage hub routing.
 * @class Manager
 * @extends Port
 * @param {Hub} hub The routing hub to control.
 * @constructor
 */
fdom.port.Manager = function(hub) {
  this.id = 'control';
  this.config = {};
  this.controlFlows = {};
  this.dataFlows = {};
  this.dataFlows[this.id] = [];
  this.reverseFlowMap = {};
  this.hub = hub;
  this.delegate = null;
  this.toDelegate = {};
  
  this.hub.on('config', function(config) {
    mixin(this.config, config);
    this.emit('config');
  }.bind(this));
  
  handleEvents(this);
  this.hub.register(this);
};

/**
 * Provide a textual description of this port.
 * @method toString
 * @return {String} the description of this port.
 */
fdom.port.Manager.prototype.toString = function() {
  return "[Local Controller]";
};

/**
 * Process messages sent to this port.
 * The manager, or 'control' destination handles several types of messages,
 * identified by the request property.  The actions are:
 * 1. debug. Prints the message to the console.
 * 2. link. Creates a link between the source and a provided destination port.
 * 3. port. Creates a link between the source and a described port type.
 * 4. delegate. Routes a defined set of control messages to another location.
 * 5. resource. Registers the source as a resource resolver.
 * 6. core. Generates a core provider for the requester.
 * 7. close. Tears down routes involing the requesting port.
 * 8. unlink. Tears down a route from the requesting port.
 * @method onMessage
 * @param {String} flow The source identifier of the message.
 * @param {Object} message The received message.
 */
fdom.port.Manager.prototype.onMessage = function(flow, message) {
  var reverseFlow = this.controlFlows[flow], origin;
  if (!reverseFlow) {
    fdom.debug.warn("Unknown message source: " + flow);
    return;
  }
  origin = this.hub.getDestination(reverseFlow);

  if (this.delegate && reverseFlow !== this.delegate && this.toDelegate[flow]) {
    // Ship off to the delegee
    this.emit(this.delegate, {
      type: 'Delegation',
      request: 'handle',
      quiet: true,
      flow: flow,
      message: message
    });
    return;
  }

  if (message.request === 'debug') {
    if (this.config.debug) {
      fdom.debug.print(message);
    }
    return;
  }

  if (message.request === 'link') {
    this.createLink(origin, message.name, message.to, message.overrideDest);
  } else if (message.request === 'port') {
    if (message.exposeManager) {
      message.args = this;
    }
    this.createLink(origin, message.name, 
        new fdom.port[message.service](message.args));
  } else if (message.request === 'bindport') {
    this.createLink({id: message.id},
                    'custom' + message.port,
                    new fdom.port[message.service](message.args),
                    'default',
                    true);
  } else if (message.request === 'delegate') {
    // Initate Delegation.
    if (this.delegate === null) {
      this.delegate = reverseFlow;
    }
    this.toDelegate[message.flow] = true;
    this.emit('delegate');
  } else if (message.request === 'resource') {
    fdom.resources.addResolver(message.args[0]);
    fdom.resources.addRetriever(message.service, message.args[1]);
  } else if (message.request === 'core') {
    if (this.core && reverseFlow === this.delegate) {
      (new this.core()).onMessage(origin, message.message);
      return;
    }
    this.getCore(function(to, core) {
      this.hub.onMessage(to, {
        type: 'core',
        core: core
      });
    }.bind(this, reverseFlow));
  } else if (message.request === 'close') {
    this.destroy(origin);
  } else if (message.request === 'unlink') {
    this.removeLink(origin, message.to);
  } else {
    fdom.debug.warn("Unknown control request: " + message.request);
    fdom.debug.log(JSON.stringify(message));
    return;
  }
};

/**
 * Set up a port with the hub.
 * @method setup
 * @param {Port} port The port to register.
 */
fdom.port.Manager.prototype.setup = function(port) {
  if (!port.id) {
    fdom.debug.warn("Refusing to setup unidentified port ");
    return false;
  }

  if(this.controlFlows[port.id]) {
    fdom.debug.warn("Refusing to re-initialize port " + port.id);
    return false;
  }

  if (!this.config.global) {
    this.once('config', this.setup.bind(this, port));
    return;
  }

  this.hub.register(port);
  var flow = this.hub.install(this, port.id, "control"),
      reverse = this.hub.install(port, this.id, port.id);
  this.controlFlows[port.id] = flow;
  this.dataFlows[port.id] = [reverse];
  this.reverseFlowMap[flow] = reverse;
  this.reverseFlowMap[reverse] = flow;

  this.hub.onMessage(flow, {
    type: 'setup',
    channel: reverse,
    config: this.config
  });

  return true;
};

/**
 * Tear down a port on the hub.
 * @method destroy
 * @apram {Port} port The port to unregister.
 */
fdom.port.Manager.prototype.destroy = function(port) {
  if (!port.id) {
    fdom.debug.warn("Unable to tear down unidentified port");
    return false;
  }

  // Remove the port.
  delete this.controlFlows[port.id];

  // Remove associated links.
  var i;
  for (i = this.dataFlows[port.id].length - 1; i >= 0; i -= 1) {
    this.removeLink(port, this.dataFlows[port.id][i]);
  }

  // Remove the port.
  delete this.dataFlows[port.id];
  this.hub.deregister(port);
};

/**
 * Create a link between two ports.  Links are created in both directions,
 * and a message with those capabilities is sent to the source port.
 * @method createLink
 * @param {Port} port The source port.
 * @param {String} name The flow for messages from destination to port.
 * @param {Port} destiantion The destination port.
 * @param {String} [destName] The flow name for messages to the destination.
 * @param {Boolean} [toDest] Tell the destination rather than source about the link.
 */
fdom.port.Manager.prototype.createLink = function(port, name, destination, destName, toDest) {
  if (!this.config.global) {
    this.once('config', this.createLink.bind(this, port, name, destination, destName));
    return; 
  }

  if (!this.controlFlows[destination.id]) {
    if(this.setup(destination) === false) {
      fdom.debug.warn('Could not find or setup destination.');
      return;
    }
  }
  var outgoingName = destName || 'default',
      outgoing = this.hub.install(port, destination.id, outgoingName),
      reverse;

  // Recover the port so that listeners are installed.
  destination = this.hub.getDestination(outgoing);
  reverse = this.hub.install(destination, port.id, name);

  this.reverseFlowMap[outgoing] = reverse;
  this.dataFlows[port.id].push(outgoing);
  this.reverseFlowMap[reverse] = outgoing;
  this.dataFlows[destination.id].push(reverse);

  if (toDest) {
    this.hub.onMessage(this.controlFlows[destination.id], {
      type: 'createLink',
      name: outgoingName,
      channel: reverse,
      reverse: outgoing
    });
  } else {
    this.hub.onMessage(this.controlFlows[port.id], {
      name: name,
      type: 'createLink',
      channel: outgoing,
      reverse: reverse
    });
  }
};

/**
 * Remove a link between to ports. The reverse link will also be removed.
 * @method removeLink
 * @param {Port} port The source port.
 * @param {String} name The flow to be removed.
 */
fdom.port.Manager.prototype.removeLink = function(port, name) {
  var reverse = this.hub.getDestination(name),
      rflow = this.reverseFlowMap[name],
      i;

  if (!reverse || !rflow) {
    fdom.debug.warn("Could not find metadata to remove flow: " + name);
    return;
  }

  if (this.hub.getDestination(rflow).id !== port.id) {
    fdom.debug.warn("Source port does not own flow " + name);
    return;
  }

  // Notify ports that a channel is closing.
  i = this.controlFlows[port.id];
  if (i) {
    this.hub.onMessage(i, {
      type: 'close',
      channel: name
    });
  }
  i = this.controlFlows[reverse.id];
  if (i) {
    this.hub.onMessage(i, {
      type: 'close',
      channel: rflow
    });
  }

  // Uninstall the channel.
  this.hub.uninstall(port, name);
  this.hub.uninstall(reverse, rflow);

  delete this.reverseFlowMap[name];
  delete this.reverseFlowMap[rflow];
  if (this.dataFlows[reverse.id]) {
    for (i = 0; i < this.dataFlows[reverse.id].length; i += 1) {
      if (this.dataFlows[reverse.id][i] === rflow) {
        this.dataFlows[reverse.id].splice(i, 1);
        break;
      }
    }
  }
  if (this.dataFlows[port.id]) {
    for (i = 0; i < this.dataFlows[port.id].length; i += 1) {
      if (this.dataFlows[port.id][i] === name) {
        this.dataFlows[port.id].splice(i, 1);
        break;
      }
    }
  }
};

/**
 * Get the core freedom.js API active on the current hub.
 * @method getCore
 * @private
 * @param {Function} cb Callback to fire with the core object.
 */
fdom.port.Manager.prototype.getCore = function(cb) {
  if (this.core) {
    cb(this.core);
  } else {
    fdom.apis.getCore('core', this).done(function(core) {
      this.core = core;
      cb(this.core);
    }.bind(this));
  }
};

/*globals fdom:true, handleEvents, eachProp */
/*jslint indent:2, white:true, node:true, sloppy:true, browser:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}
fdom.port = fdom.port || {};

/**
 * A freedom port for a user-accessable provider.
 * @class Provider
 * @extends Port
 * @uses handleEvents
 * @param {Object} def The interface of the provider.
 * @contructor
 */
fdom.port.Provider = function(def) {
  this.id = fdom.port.Proxy.nextId();
  handleEvents(this);
  
  this.definition = def;
  this.synchronous = false;
  this.iface = null;
  this.providerCls = null;
  this.providerInstances = {};
};

/**
 * Receive external messages for the provider.
 * @method onMessage
 * @param {String} source the source identifier of the message.
 * @param {Object} message The received message.
 */
fdom.port.Provider.prototype.onMessage = function(source, message) {
  if (source === 'control' && message.reverse) {
    this.emitChannel = message.channel;
    this.emit(this.emitChannel, {
      type: 'channel announcment',
      channel: message.reverse
    });
    this.emit('start');
  } else if (source === 'control' && message.type === 'setup') {
    this.controlChannel = message.channel;
  } else if (source === 'control' && message.type === 'close') {
    if (message.channel === this.controlChannel) {
      delete this.controlChannel;
    }
    this.close();
  } else if (source === 'default') {
    if (!this.emitChannel && message.channel) {
      this.emitChannel = message.channel;
      this.emit('start');
      return;
    }
    if (message.type === 'close' && message.to) {
      delete this.providerInstances[message.to];
    } else if (message.to && this.providerInstances[message.to]) {
      this.providerInstances[message.to](message.message);
    } else if (message.to && message.message && message.message.type === 'construct') {
      this.providerInstances[message.to] = this.getProvider(message.to);
    } else {
      fdom.debug.warn(this.toString() + ' dropping message ' + JSON.stringify(message));
    }
  }
};

/**
 * Close / teardown the flow this provider terminates.
 * @method doClose
 */
fdom.port.Provider.prototype.close = function() {
  if (this.controlChannel) {
    this.emit(this.controlChannel, {
      type: 'Provider Closing',
      request: 'close'
    });
    delete this.controlChannel;
  }

  this.providerInstances = {};
  this.emitChannel = null;
};

/**
 * Get an interface to expose externally representing this port.
 * Providers are registered with the port using either
 * provideSynchronous or provideAsynchronous depending on the desired
 * return interface.
 * @method getInterface
 * @return {Object} The external interface of this Provider.
 */
fdom.port.Provider.prototype.getInterface = function() {
  if (this.iface) {
    return this.iface;
  } else {
    this.iface = {
      provideSynchronous: function(prov) {
        this.providerCls = prov;
      }.bind(this),
      provideAsynchronous: function(prov) {
        this.providerCls = prov;
        this.synchronous = false;
      }.bind(this),
      close: function() {
        this.close();
      }.bind(this)
    };

    eachProp(this.definition, function(prop, name) {
      switch(prop.type) {
      case "constant":
        Object.defineProperty(this.iface, name, {
          value: fdom.proxy.recursiveFreezeObject(prop.value),
          writable: false
        });
        break;
      }
    }.bind(this));

    return this.iface;
  }
};

/**
 * Create a function that can be used to get interfaces from this provider from
 * a user-visible point.
 * @method getProxyInterface
 */
fdom.port.Provider.prototype.getProxyInterface = function() {
  var func = function(p) {
    return p.getInterface();
  }.bind({}, this);

  func.close = function(iface) {
    if (iface) {
      eachProp(this.ifaces, function(candidate, id) {
        if (candidate === iface) {
          this.teardown(id);
          this.emit(this.emitChannel, {
            type: 'close',
            to: id
          });
          return true;
        }
      }.bind(this));      
    } else {
      // Close the channel.
      this.doClose();
    }
  }.bind(this);

  func.onClose = function(iface, handler) {
    if (typeof iface === 'function' && handler === undefined) {
      // Add an on-channel-closed handler.
      this.once('close', iface);
      return;
    }

    eachProp(this.ifaces, function(candidate, id) {
      if (candidate === iface) {
        if (this.handlers[id]) {
          this.handlers[id].push(handler);
        } else {
          this.handlers[id] = [handler];
        }
        return true;
      }
    }.bind(this));
  }.bind(this);

  return func;
};

/**
 * Get a new instance of the registered provider.
 * @method getProvider
 * @param {String} identifier the messagable address for this provider.
 * @return {Function} A function to send messages to the provider.
 */
fdom.port.Provider.prototype.getProvider = function(identifier) {
  if (!this.providerCls) {
    fdom.debug.warn('Cannot instantiate provider, since it is not provided');
    return null;
  }
  var instance = new this.providerCls(),
      events = {};

  eachProp(this.definition, function(prop, name) {
    if (prop.type === 'event') {
      events[name] = prop;
    }
  });
  
  instance.dispatchEvent = function(events, id, name, value) {
    if (events[name]) {
      this.emit(this.emitChannel, {
        type: 'message',
        to: id,
        message: {
          name: name,
          type: 'event',
          value: fdom.proxy.conform(events[name].value, value)
        }
      });
    }
  }.bind(this, events, identifier);

  return function(port, msg) {
    if (msg.action === 'method') {
      if (typeof this[msg.type] !== 'function') {
        fdom.debug.warn("Provider does not implement " + msg.type + "()!");
        return;
      }
      var args = msg.value,
          ret = function(to, req, type, ret) {
            this.emit(this.emitChannel, {
              type: 'method',
              to: to,
              message: {
                type: 'method',
                reqId: req,
                name: type,
                value: ret
              }
            });
          }.bind(port, msg.to, msg.reqId, msg.type);
      if (!Array.isArray(args)) {
        args = [args];
      }
      if (port.synchronous) {
        ret(this[msg.type].apply(this, args));
      } else {
        this[msg.type].apply(instance, args.concat(ret));
      }
    }
  }.bind(instance, this);
};

/**
 * Get a textual description of this port.
 * @method toString
 * @return {String} the description of this port.
 */
fdom.port.Provider.prototype.toString = function() {
  if (this.emitChannel) {
    return "[Provider " + this.emitChannel + "]";
  } else {
    return "[unbound Provider]";
  }
};
/*globals fdom:true, handleEvents, eachProp */
/*jslint indent:2, white:true, sloppy:true, browser:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}
fdom.port = fdom.port || {};

/**
 * A freedom port for a user-accessable proxy.
 * @class Proxy
 * @extends Port
 * @uses handleEvents
 * @param {Object} interfaceCls The proxy interface exposed by this proxy.
 * @constructor
 */
fdom.port.Proxy = function(interfaceCls) {
  this.id = fdom.port.Proxy.nextId();
  this.interfaceCls = interfaceCls;
  handleEvents(this);
  
  this.ifaces = {};
  this.closeHandlers = {};
  this.errorHandlers = {};
  this.emits = {};
};

/**
 * Receive incoming messages for this proxy.
 * @method onMessage
 * @param {String} source The source of the message.
 * @param {Object} message The received message.
 */
fdom.port.Proxy.prototype.onMessage = function(source, message) {
  if (source === 'control' && message.reverse) {
    this.emitChannel = message.channel;
    this.emit(this.emitChannel, {
      type: 'channel announcement',
      channel: message.reverse
    });
    this.emit('start');
  } else if (source === 'control' && message.type === 'setup') {
    this.controlChannel = message.channel;
  } else if (source === 'control' && message.type === 'close') {
    delete this.controlChannel;
    this.doClose();
  } else if (source === 'default') {
    if (!this.emitChannel && message.channel) {
      this.emitChannel = message.channel;
      this.emit('start');
      return;
    }
    if (message.type === 'close' && message.to) {
      this.teardown(message.to);
      return;
    }
    if (message.type === 'error') {
      this.error(message.to, message.message);
      return;
    }
    if (message.to) {
      if (this.emits[message.to]) {
        this.emits[message.to]('message', message.message);
      } else {
        fdom.debug.warn('Could not deliver message, no such interface: ' + message.to);
      }
    } else {
      eachProp(this.emits, function(iface) {
        iface('message', message.message);
      });
    }
  }
};

/**
 * Create a proxy.Interface associated with this proxy.
 * An interface is returned, which is supplied with important control of the
 * proxy via constructor arguments: (bound below in getInterfaceConstructor)
 * 
 * onMsg: function(binder) sets the function to call when messages for this
 *    interface arrive on the channel,
 * emit: function(msg) allows this interface to emit messages,
 * id: string is the Identifier for this interface.
 * @method getInterface
 */
fdom.port.Proxy.prototype.getInterface = function() {
  var Iface = this.getInterfaceConstructor();
  return new Iface();
};

/**
 * Create a function that can be used to get interfaces from this proxy from
 * a user-visible point.
 * @method getProxyInterface
 */
fdom.port.Proxy.prototype.getProxyInterface = function() {
  var func = function(p) {
    return p.getInterface();
  }.bind({}, this);

  func.close = function(iface) {
    if (iface) {
      eachProp(this.ifaces, function(candidate, id) {
        if (candidate === iface) {
          this.teardown(id);
          this.emit(this.emitChannel, {
            type: 'close',
            to: id
          });
          return true;
        }
      }.bind(this));      
    } else {
      // Close the channel.
      this.doClose();
    }
  }.bind(this);

  func.onClose = function(iface, handler) {
    if (typeof iface === 'function' && handler === undefined) {
      // Add an on-channel-closed handler.
      this.once('close', iface);
      return;
    }

    eachProp(this.ifaces, function(candidate, id) {
      if (candidate === iface) {
        if (this.closeHandlers[id]) {
          this.closeHandlers[id].push(handler);
        } else {
          this.closeHandlers[id] = [handler];
        }
        return true;
      }
    }.bind(this));
  }.bind(this);

  func.onError = function(iface, handler) {
    if (typeof iface === 'function' && handler === undefined) {
      this.on('error', iface);
      return;
    }
    eachProp(this.ifaces, function(candidate, id) {
      if (candidate === iface) {
        if (this.errorHandlers[id]) {
          this.errorHandlers[id].push(handler);
        } else {
          this.errorHandlers[id] = [handler];
        }
        return true;
      }
    }.bind(this));
  }.bind(this);
  
  return func;
};

/**
 * Provides a bound class for creating a proxy.Interface associated
 * with this proxy. This partial level of construction can be used
 * to allow the proxy to be used as a provider for another API.
 * @method getInterfaceConstructor
 * @private
 */
fdom.port.Proxy.prototype.getInterfaceConstructor = function() {
  var id = fdom.port.Proxy.nextId();
  return this.interfaceCls.bind({}, function(id, obj, binder) {
    this.ifaces[id] = obj;
    this.emits[id] = binder;
  }.bind(this, id), this.doEmit.bind(this, id));  
};

/**
 * Emit a message on the channel once setup is complete.
 * @method doEmit
 * @private
 * @param {String} to The ID of the flow sending the message.
 * @param {Object} msg The message to emit
 * @param {Boolean} all Send message to all recipients.
 */
fdom.port.Proxy.prototype.doEmit = function(to, msg, all) {
  if (all) {
    to = false;
  }
  if (this.emitChannel) {
    this.emit(this.emitChannel, {to: to, type:'message', message: msg});
  } else {
    this.once('start', this.doEmit.bind(this, to, msg));
  }
};

/**
 * Teardown a single interface of this proxy.
 * @method teardown
 * @param {String} id The id of the interface to tear down.
 */
fdom.port.Proxy.prototype.teardown = function(id) {
  delete this.emits[id];
  if (this.closeHandlers[id]) {
    eachProp(this.closeHandlers[id], function(prop) {
      prop();
    });
  }
  delete this.ifaces[id];
  delete this.closeHandlers[id];
  delete this.errorHandlers[id];
};

/**
 * Handle a message error reported to this proxy.
 * @method error
 * @param {String?} id The id of the interface where the error occured.
 * @param {Object} message The message which failed, if relevant.
 */
fdom.port.Proxy.prototype.error = function(id, message) {
  if (id && this.errorHandlers[id]) {
    eachProp(this.errorHandlers[id], function(prop) {
      prop(message);
    });
  } else if (!id) {
    this.emit('error', message);
  }
};


/**
 * Close / teardown the flow this proxy terminates.
 * @method doClose
 */
fdom.port.Proxy.prototype.doClose = function() {
  if (this.controlChannel) {
    this.emit(this.controlChannel, {
      type: 'Channel Closing',
      request: 'close'
    });
  }

  eachProp(this.emits, function(emit, id) {
    this.teardown(id);
  }.bind(this));

  this.emit('close');
  this.off();

  this.emitChannel = null;
};

/**
 * Get the textual description of this port.
 * @method toString
 * @return The description of this port.
 */
fdom.port.Proxy.prototype.toString = function() {
  if (this.emitChannel) {
    return "[Proxy " + this.emitChannel + "]";
  } else {
    return "[unbound Proxy]";
  }
};

/**
 * Get the next ID for a proxy channel.
 * @method nextId
 * @static
 * @private
 */
fdom.port.Proxy.nextId = function() {
  if (!fdom.port.Proxy.id) {
    fdom.port.Proxy.id = 1;
  }
  return (fdom.port.Proxy.id += 1);
};
/*globals fdom:true, handleEvents, mixin, WebSocket */
/*jslint indent:2, white:true, sloppy:true, browser:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}
fdom.port = fdom.port || {};

/**
 * A client communication port to a priviledged web-server capable
 * remote instance of freedom.js
 * @class Runtime
 * @extends Port
 * @uses handleEvents
 * @constructor
 */
fdom.port.Runtime = function() {
  this.id = 'runtime';
  this.config = {};
  this.runtimes = {};
  this.core = null;
  this.socket = null;
  this.status = fdom.port.Runtime.status.disconnected;
  handleEvents(this);
};

/**
 * Possible states of the Runtime port. Determines where in the
 * setup process the port is.
 * @property status
 * @protected
 * @static
 */
fdom.port.Runtime.status = {
  disconnected: 0,
  connecting: 1,
  connected: 2
};

/**
 * Get the textual description of this port.
 * @method toString
 * @returns {String} The description of this port.
 */
fdom.port.Runtime.prototype.toString = function() {
  return "[Port to Priviledged Runtime]"; 
};


/**
 * Handle a message from the local freedom environment.
 * The runtime port will strip off the recursive config sent at setup,
 * but otherwise sends messages un-altered.
 * @method onMessage
 * @param {String} source The source of the message
 * @param {Object} msg The message to send.
 */
fdom.port.Runtime.prototype.onMessage = function(source, msg) {
  if (source === 'control' && msg.type === 'setup') {
    var config = {};
    mixin(config, msg.config);
    delete config.global;
    //TODO: support long msgs.
    delete config.src;
    msg.config = config;
    this.controlChannel = msg.channel;
    this.connect();
    this.emit(this.controlChannel, {
      type: 'Get Core Provider',
      request: 'core'
    });
  } else if (source === 'control' && msg.type === 'core' && !this.core) {
    this.core = msg.core;
  }
  if (this.status === fdom.port.Runtime.status.connected) {
    this.socket.send(JSON.stringify([source, msg]));
  } else {
    this.once('connected', this.onMessage.bind(this, source, msg));
  }
};

/**
 * Attempt to connect to the runtime server.
 * Address / Port to connect to default to 127.0.0.1:9009, but can be overridden
 * by setting 'runtimeHost' and 'runtimePort' configuration options.
 * @method connect
 * @protected
 */
fdom.port.Runtime.prototype.connect = function() {
  var host = this.config.runtimeHost || '127.0.0.1',
      port = this.config.runtimePort || 9009;
  if (!this.socket && this.status === fdom.port.Runtime.status.disconnected) {
    fdom.debug.log("FreeDOM Runtime Link connecting");
    this.status = fdom.port.Runtime.status.connecting;
    this.socket = new WebSocket('ws://' + host + ':' + port);
    this.socket.addEventListener('open', function(msg) {
      fdom.debug.log("FreeDOM Runtime Link connected");
      this.status = fdom.port.Runtime.status.connected;
      this.emit('connected');
      fdom.apis.register('core.runtime', this.runtime.bind(this, this));
    }.bind(this), true);
    this.socket.addEventListener('message', this.message.bind(this), true);
    this.socket.addEventListener('close', function() {
      fdom.debug.log("FreeDOM Runtime Link disconnected");
      this.status = fdom.port.Runtime.status.disconnected;
    }.bind(this), true);
  }
};

/**
 * Process a message from the freedom.js runtime.
 * Currently, the runtime intercepts two types of messages internally:
 * 1. runtime.load messages are immediately resolved to see if the local context
 * can load the contents of a file, since the remote server may have cross origin
 * issues reading a file, or the file may only exist locally.
 * 2. runtime.message messages are delivered to the appropriate instantiatiation of
 * a Runtime.Runtime provider, for the core.runtime API.
 * Other messages are emitted normally.
 * @param {Object} msg The message to process.
 * @protected
 */
fdom.port.Runtime.prototype.message = function(msg) {
  try {
    var data = JSON.parse(msg.data);
    // Handle runtime support requests.
    if (data[0] === 'runtime' && data[1].request === 'load') {
      fdom.resources.getContents(data[1].url).done(function(url, from, data) {
        this.onMessage('runtime', {
          response: 'load',
          file: url,
          from: from,
          data: data
        });
      }.bind(this, data[1].url, data[1].from));
      return;
    } else if (data[0] === 'runtime' && data[1].request === 'message') {
      if (!this.runtimes[data[1].id]) {
        fdom.debug.warn('Asked to relay to non-existant runtime:' + data[1].id);
      }
      this.runtimes[data[1].id].channel.emit(data[1].data[0], data[1].data[1]);
    }
    this.emit(data[0], data[1]);
  } catch(e) {
    fdom.debug.warn(e.stack);
    fdom.debug.warn('Unable to parse runtime message: ' + msg);
  }
};

/**
 * A Runtime, backing the 'core.runtime' API.
 * The runtime object handles requests by local applications wanting to
 * interact with the freedom.js runtime. Primarily, this is done by
 * using 'createApp' to connect with a remote application.
 * @class Runtime.Runtime
 * @constructor
 * @param {Runtime} link The runtime port associated with this provider.
 * @param {App} app The app creating this provider.
 */
fdom.port.Runtime.prototype.runtime = function(link, app) {
  this.id = Math.random();
  this.link = link;
  this.app = app;
  this.link.runtimes[this.id] = this;
};

/**
 * Create a remote App with a specified manifest.
 * TODO(willscott): This should probably be refactored to 'connectApp',
 *     Since there shouldn't be a distinction between creation and re-connection.
 *     Additionally, the Final API for core.runtime remains undetermined.
 * @method createApp
 * @param {String} manifest The app to start.
 * @param {Object} proxy The identifier of the communication channel to use
 * to talk with the created app.
 */
fdom.port.Runtime.prototype.runtime.prototype.createApp = function(manifest, proxy) {
  fdom.resources.get(this.app.manifestId, manifest).done(function(url) {
    this.link.onMessage('runtime', {
      request: 'createApp',
      from: this.app.manifestId,
      to: url,
      id: this.id
    });
    // The created channel gets terminated with the runtime port.
    // Messages are then tunneled to the runtime.
    // Messages from the runtime are delivered in Runtime.message.
    this.link.core.bindChannel(proxy).done(function(iface) {
      iface.on(function(flow, msg) {
        this.link.onMessage('runtime', {
          request: 'message',
          id: this.id,
          data: [flow, msg]
        });
        return false;
      }.bind(this));
      this.channel = iface;
    }.bind(this));
  }.bind(this));
};
/*globals fdom:true, handleEvents, mixin, isAppContext, Worker */
/*jslint indent:2, white:true, node:true, sloppy:true, browser:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}
fdom.port = fdom.port || {};

/**
 * A port providing message transport between two freedom contexts via Worker.
 * @class Worker
 * @extends Port
 * @uses handleEvents
 * @constructor
 */
fdom.port.Worker = function() {
  this.id = 'Worker ' + Math.random();
  this.config = {};

  handleEvents(this);
};

/**
 * Start this port by listening or creating a worker.
 * @method start
 * @private
 */
fdom.port.Worker.prototype.start = function() {
  if (isAppContext()) {
    this.setupListener();
  } else {
    this.setupWorker();
  }
};

/**
 * Stop this port by destroying the worker.
 * @method stop
 * @private
 */
fdom.port.Worker.prototype.stop = function() {
  // Function is determined by setupListener or setupFrame as appropriate.
};

/**
 * Get the textual description of this port.
 * @method toString
 * @return {String} the description of this port.
 */
fdom.port.Worker.prototype.toString = function() {
  return "[" + this.id + "]";
};

/**
 * Set up a global listener to handle incoming messages to this
 * freedom.js context.
 * @method setupListener
 */
fdom.port.Worker.prototype.setupListener = function() {
  var onMsg = function(msg) {
    this.emitMessage(msg.data.flow, msg.data.message);
  }.bind(this);
  this.obj = this.config.global;
  this.obj.addEventListener('message', onMsg, true);
  this.stop = function() {
    this.obj.removeEventListener('message', onMsg, true);
    delete this.obj;
  };
  this.emit('started');
};

/**
 * Emit messages to the the hub, mapping control channels.
 * @method emitMessage
 * @param {String} flow the flow to emit the message on.
 * @param {Object} messgae The message to emit.
 */
fdom.port.Worker.prototype.emitMessage = function(flow, message) {
  if (flow === 'control' && this.controlChannel) {
    flow = this.controlChannel;
  }
  this.emit(flow, message);
};

/**
 * Set up a worker with an isolated freedom.js context inside.
 * @method setupWorker
 */
fdom.port.Worker.prototype.setupWorker = function() {
  var worker, blob;
  if (typeof (window.Blob) !== typeof (Function)) {
    worker = new Worker(this.config.source);
  } else {
    blob = new window.Blob([this.config.src], {type: 'text/javascript'});
    worker = new Worker(window.URL.createObjectURL(blob));
  }
  worker.addEventListener('error', function(err) {
    fdom.debug.error(err, this.toString());
  }, true);
  worker.addEventListener('message', function(worker, msg) {
    if (!this.obj) {
      this.obj = worker;
      this.emit('started');
    }
    this.emitMessage(msg.data.flow, msg.data.message);
  }.bind(this, worker), true);
  this.stop = function() {
    worker.stop();
    if (this.obj) {
      delete this.obj;
    }
  };
};

/**
 * Receive messages from the hub to this port.
 * Received messages will be emitted from the other side of the port.
 * @method onMessage
 * @param {String} flow the channel/flow of the message.
 * @param {Object} message The Message.
 */
fdom.port.Worker.prototype.onMessage = function(flow, message) {
  if (flow === 'control' && !this.controlChannel) {
    if (!this.controlChannel && message.channel) {
      this.controlChannel = message.channel;
      mixin(this.config, message.config);
      this.start();
    }
  } else if (flow === 'control' && message.type === 'close' &&
      message.channel === 'control') {
    this.stop();
  } else {
    if (this.obj) {
      //fdom.debug.log('message sent to worker: ', flow, message);
      this.obj.postMessage({
        flow: flow,
        message: message
      });
    } else {
      this.once('started', this.onMessage.bind(this, flow, message));
    }
  }
};

/*globals fdom:true, XMLHttpRequest */
/*jslint indent:2,white:true,node:true,sloppy:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}

/**
 * The Resource registry for FreeDOM.  Used to look up requested Resources,
 * and provide lookup and migration of resources.
 * @Class Resource
 * @constructor
 */
var Resource = function() {
  this.files = {};
  this.resolvers = [this.httpResolver];
  this.contentRetreivers = {
    'http': this.xhrRetriever,
    'https': this.xhrRetriever,
    'chrome-extension': this.xhrRetriever,
    'resource': this.xhrRetriever,
    'chrome': this.xhrRetriever,
    'manifest': this.manifestRetriever
  };
};

/**
 * Resolve a resurce URL requested from a module.
 * @method get
 * @param {String} manifest The canonical address of the module requesting.
 * @param {String} url The resource to get.
 * @returns {fdom.Proxy.Deferred} A promise for the resource address.
 */
Resource.prototype.get = function(manifest, url) {
  var key = JSON.stringify([manifest, url]),
      deferred = fdom.proxy.Deferred();
  if (this.files[key]) {
    deferred.resolve(this.files[key]);
  } else {
    this.resolve(manifest, url).always(function(key, deferred, address) {
      this.files[key] = address;
      fdom.debug.log('Resolved ' + key + ' to ' + address);
      deferred.resolve(address);
    }.bind(this, key, deferred));
  }

  return deferred.promise();
};

/**
 * Get the contents of a resource.
 * @method getContents
 * @param {String} url The resource to read.
 * @returns {fdom.Proxy.Deferred} A promise for the resource contents.
 */
Resource.prototype.getContents = function(url) {
  var prop,
      deferred = fdom.proxy.Deferred();
  if (!url) {
    fdom.debug.warn("Asked to get contents of undefined URL.");
    deferred.reject();
    return deferred.promise();
  }
  for (prop in this.contentRetreivers) {
    if (this.contentRetreivers.hasOwnProperty(prop)) {
      if (url.indexOf(prop + "://") === 0) {
        this.contentRetreivers[prop](url, deferred);
        return deferred.promise();
      }
    }
  }

  deferred.reject();
  return deferred.promise();
};

/**
 * Resolve a resource using known resolvers. Unlike get, resolve does
 * not cache resolved resources.
 * @method resolve
 * @private
 * @param {String} manifest The module requesting the resource.
 * @param {String} url The resource to resolve;
 * @returns {fdom.proxy.Deferred} A promise for the resource address.
 */
Resource.prototype.resolve = function(manifest, url) {
  var deferred = fdom.proxy.Deferred(),
      i = 0;
  if (url === undefined) {
    deferred.reject();
    return deferred.promise();
  }
  for (i = 0; i < this.resolvers.length; i += 1) {
    if(this.resolvers[i](manifest, url, deferred)) {
      return deferred.promise();
    }
  }
  deferred.reject();
  return deferred.promise();
};

/**
 * Register resolvers: code that knows how to get resources
 * needed by the runtime. A resolver will be called with three
 * arguments: the absolute manifest of the requester, the
 * resource being requested, and a deferred object to populate.
 * It returns a boolean of whether or not it can resolve the requested
 * resource.
 * @method addResolver
 * @param {Function} resolver The resolver to add.
 */
Resource.prototype.addResolver = function(resolver) {
  this.resolvers.push(resolver);
};

/**
 * Register retrievers: code that knows how to load resources
 * needed by the runtime. A retriever will be called with a URL
 * to retrieve with a protocol that it is able to handle.
 * @method addRetriever
 * @param {String} proto The protocol to register for.
 * @param {Function} retriever The retriever to add.
 */
Resource.prototype.addRetriever = function(proto, retriever) {
  if (this.contentRetreivers[proto]) {
    fdom.debug.warn("Unwilling to override file retrieval for " + proto);
    return;
  }
  this.contentRetreivers[proto] = retriever;
};

/**
 * Resolve URLs which can be accessed using standard HTTP requests.
 * @method httpResolver
 * @private
 * @param {String} manifest The Manifest URL.
 * @param {String} url The URL to resolve.
 * @param {fdom.proxy.Deferred} deferred The deferred object to populate.
 * @returns {Boolean} True if the URL could be resolved.
 */
Resource.prototype.httpResolver = function(manifest, url, deferred) {
  var protocols = ["http", "https", "chrome", "chrome-extension", "resource"],
      dirname,
      i, protocolIdx, pathIdx,
      path, base;
  for (i = 0; i < protocols.length; i += 1) {
    if (url.indexOf(protocols[i] + "://") === 0) {
      deferred.resolve(url);
      return true;
    }
  }
  
  for (i = 0; i < protocols.length; i += 1) {
    if (manifest.indexOf(protocols[i] + "://") === 0 &&
       url.indexOf("://") === -1) {
      dirname = manifest.substr(0, manifest.lastIndexOf("/"));
      protocolIdx = dirname.indexOf("://");
      pathIdx = protocolIdx + 3 + dirname.substr(protocolIdx + 3).indexOf("/");
      path = dirname.substr(pathIdx);
      base = dirname.substr(0, pathIdx);
      if (url.indexOf("/") === 0) {
        deferred.resolve(base + url);
      } else {
        deferred.resolve(base + path + "/" + url);
      }
      return true;
    }
  }

  return false;
};

/**
 * Retrieve manifest content from a self-descriptive manifest url.
 * These urls are used to reference a manifest without requiring subsequent,
 * potentially non-CORS requests.
 * @method manifestRetriever
 * @private
 * @param {String} manifest The Manifest URL
 * @param {fdom.proxy.Deferred} deferred The deferred object to populate.
 */
Resource.prototype.manifestRetriever = function(manifest, deferred) {
  var data;
  try {
    data = manifest.substr(11);
    deferred.resolve(JSON.parse(data));
  } catch(e) {
    console.warn("Invalid manifest URL referenced:" + manifest);
    deferred.reject();
  }
};

/**
 * Retrieve resource contents using an XHR request.
 * @method xhrRetriever
 * @private
 * @param {String} url The resource to fetch.
 * @param {fdom.proxy.Deferred} deferred The deferred object to populate.
 */
Resource.prototype.xhrRetriever = function(url, deferred) {
  var ref = new XMLHttpRequest();
  ref.addEventListener('readystatechange', function(deferred) {
    if (ref.readyState === 4 && ref.responseText) {
      deferred.resolve(ref.responseText);
    } else if (ref.readyState === 4) {
      console.warn("Failed to load file " + url + ": " + ref.status);
      deferred.reject(ref.status);
    }
  }.bind({}, deferred), false);
  ref.overrideMimeType('application/json');
  ref.open("GET", url, true);
  ref.send();
};

/**
 * Defines fdom.resources as a singleton registry for file management.
 */
fdom.resources = new Resource();
/**
 * Utility method used within the freedom Library.
 * @class util
 * @static
 */
var Util = {};


/**
 * Helper function for iterating over an array backwards. If the func
 * returns a true value, it will break out of the loop.
 * @method eachReverse
 * @static
 */
function eachReverse(ary, func) {
  if (ary) {
    var i;
    for (i = ary.length - 1; i > -1; i -= 1) {
      if (ary[i] && func(ary[i], i, ary)) {
        break;
      }
    }
  }
}

/**
 * @method hasProp
 * @static
 */
function hasProp(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 * Cycles over properties in an object and calls a function for each
 * property value. If the function returns a truthy value, then the
 * iteration is stopped.
 * @method eachProp
 * @static
 */
function eachProp(obj, func) {
  var prop;
  for (prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      if (func(obj[prop], prop)) {
        break;
      }
    }
  }
}

/**
 * Simple function to mix in properties from source into target,
 * but only if target does not already have a property of the same name.
 * This is not robust in IE for transferring methods that match
 * Object.prototype names, but the uses of mixin here seem unlikely to
 * trigger a problem related to that.
 * @method mixin
 * @static
 */
function mixin(target, source, force) {
  if (source) {
    eachProp(source, function (value, prop) {
      if (force || !hasProp(target, prop)) {
        target[prop] = value;
      }
    });
  }
  return target;
}

/**
 * Get a unique ID.
 * @method getId
 * @static
 */
function getId() {
  var guid = 'guid',
      domain = 12;
  if (typeof crypto === 'object') {
    var buffer = new Uint8Array(domain);
    crypto.getRandomValues(buffer);
    eachReverse(buffer, function(n) {
      guid += '-' + n;
    });
  } else {
    while (domain > 0) {
      guid += '-' + Math.ceil(255 * Math.random());
      domain -= 1;
    }
  }

  return guid;
}

/**
 * Add 'on' and 'emit' methods to an object, which act as a light weight
 * event handling structure.
 * @class handleEvents
 * @static
 */
function handleEvents(obj) {
  var eventState = {
    listeners: {},
    conditional: [],
    oneshots: {},
    onceConditional: []
  };

  /**
   * Filter a list based on a predicate. The list is filtered in place, with
   * selected items removed and returned by the function.
   * @method
   * @param {Array} list The list to filter
   * @param {Function} predicate The method to run on each item.
   * @returns {Array} Selected items
   */
  var filter = function(list, predicate) {
    var ret = [], i;

    if (!list || !list.length) {
      return [];
    }

    for (i = list.length - 1; i >= 0; i--) {
      if (predicate(list[i])) {
        ret.push(list.splice(i, 1));
      }
    }
    return ret;
  };

  /**
   * Register a method to be executed when an event of a specific type occurs.
   * @method on
   * @param {String|Function} type The type of event to register against.
   * @param {Function} handler The handler to run when the event occurs.
   */
  obj['on'] = function(type, handler) {
    if (typeof type === 'function') {
      this.conditional.push([type, handler]);
    } else if (this.listeners[type]) {
      this.listeners[type].push(handler);
    } else {
      this.listeners[type] = [handler];
    }
  }.bind(eventState);

  /**
   * Register a method to be execute the next time an event occurs.
   * @method once
   * @param {String|Function} type The type of event to wait for.
   * @param {Function} handler The handler to run the next time a matching event
   *     is raised.
   */
  obj['once'] = function(type, handler) {
    if (typeof type === 'function') {
      this.onceConditional.push([type, handler]);
    } else if (this.oneshots[type]) {
      this.oneshots[type].push(handler);
    } else {
      this.oneshots[type] = [handler];
    }
  }.bind(eventState);

  /**
   * Emit an event on this object.
   * @method emit
   * @param {String} type The type of event to raise.
   * @param {Object} data The payload of the event.
   */
  obj['emit'] = function(type, data) {
    var i;
    if (this.listeners[type]) {
      for (i = 0; i < this.listeners[type].length; i++) {
        if (this.listeners[type][i](data) === false) {
          return;
        }
      }
    }
    if (this.oneshots[type]) {
      for (i = 0; i < this.oneshots[type].length; i++) {
        this.oneshots[type][i](data);
      }
      this.oneshots[type] = [];
    }
    for (i = 0; i < this.conditional.length; i++) {
      if (this.conditional[i][0](type, data)) {
        this.conditional[i][1](data);
      }
    }
    for (i = this.onceConditional.length - 1; i >= 0; i--) {
      if (this.onceConditional[i][0](type, data)) {
        var cond = this.onceConditional.splice(i, 1);
        cond[0][1](data);
      }
    }
  }.bind(eventState);

  /**
   * Remove an event handler
   * @method off
   * @param {String} type The type of event to remove.
   * @param {Function?} handler The handler to remove.
   */
  obj['off'] = function(type, handler) {
    var i;
    if (!type) {
      this.listeners = {};
      this.conditional = [];
      this.oneshots = {};
      this.onceConditional = [];
      return;
    }

    if (typeof type === 'function') {
      filter(this.onceConditional, function(item) {
        return item[0] === type && (!handler || item[1] === handler);
      });
      filter(this.conditional, function(item) {
        return item[0] === type && (!handler || item[1] === handler);
      });
    }

    if (!handler) {
      delete this.listeners[type];
      delete this.oneshots[type];
    } else {
      filter(this.listeners[type], function(item) {
        return item === handler;
      });
      filter(this.oneshots[type], function(item) {
        return item === handler;
      });
    }
  }.bind(eventState);
}

/**
 * When run without a window, or specifically requested.
 * @method isAppContext
 * @for util
 * @static
 */
function isAppContext() {
  return (typeof window === 'undefined');
}

/**
 * Get a Blob object of a string.
 * Polyfills implementations which don't have a current Blob constructor, like
 * phantomjs.
 * @method getBlob
 * @static
 */
function getBlob(data, type) {
  if (typeof Blob !== 'function' && typeof WebKitBlobBuilder !== 'undefined') {
    var builder = new WebKitBlobBuilder();
    builder.append(data);
    return builder.getBlob(type);
  } else {
    return new Blob([data], {type: type});
  }
}

/**
 * Get a URL of a blob object for inclusion in a frame.
 * Polyfills implementations which don't have a current URL object, like
 * phantomjs.
 * @method getURL
 * @static
 */
function getURL(blob) {
  if (typeof URL !== 'object' && typeof webkitURL !== 'undefined') {
    return webkitURL.createObjectURL(blob);
  } else {
    return URL.createObjectURL(blob);
  }
}

/**
 * Provide a version of src where the 'isAppContext' function will return true.
 * Used for creating app contexts which may not be able to determine that they
 * need to start up as applications by themselves.
 * @method forceAppContext
 * @static
 */
function forceAppContext(src) {
  var declaration = "function " + isAppContext.name + "()",
      definition = " { return true; }",
      idx = src.indexOf(declaration),
      source,
      blob;
  if (idx === -1) {
    fdom.debug.warn('Unable to force App Context, source has been mangled.');
    return;
  }
  source = src.substr(0, idx + declaration.length) + definition +
      " function " + isAppContext.name + '_()' +
      src.substr(idx + declaration.length);
  blob = getBlob(source, 'text/javascript');
  return getURL(blob);
}

/**
 * When running in a priviledged context, honor a global
 * 'freedomcfg' function to allow registration of additional API providers.
 * @method advertise
 * @param {Boolean} force Advertise even if not in a priviledged context.
 * @static
 */
function advertise(force) {
  // TODO: Determine a better mechanism than this whitelisting.
  if ((location.protocol === 'chrome-extension:' ||
       location.protocol === 'chrome:' ||
      location.protocol == 'resource:' || force) &&
      typeof freedomcfg !== "undefined") {
    freedomcfg(fdom.apis.register.bind(fdom.apis));
  }
}

/**
 * Find all scripts on the given page.
 * @method scripts
 * @static
 */
function scripts() {
    return document.getElementsByTagName('script');
}
/*globals fdom:true, handleEvents, eachProp, Blob, ArrayBuffer */
/*jslint indent:2, white:true, node:true, sloppy:true, browser:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}
fdom.proxy = fdom.proxy || {};

fdom.proxy.ApiInterface = function(def, onMsg, emit) {
  var inflight = {},
      events = null,
      emitter = null,
      reqId = 0;

  eachProp(def, function(prop, name) {
    switch(prop.type) {
    case 'method':
      this[name] = function() {
        // Note: inflight should be registered before message is passed
        // in order to prepare for synchronous in-window pipes.
        var deferred = fdom.proxy.Deferred();
        inflight[reqId] = deferred;
        emit({
          action: 'method',
          type: name,
          reqId: reqId,
          value: fdom.proxy.conform(prop.value, arguments)
        });
        reqId += 1;
        return deferred.promise();
      };
      break;
    case 'event':
      if(!events) {
        handleEvents(this);
        emitter = this.emit;
        delete this.emit;
        events = {};
      }
      events[name] = prop;
      break;
    case 'constant':
      Object.defineProperty(this, name, {
        value: fdom.proxy.recursiveFreezeObject(prop.value),
        writable: false
      });
      break;
    }
  }.bind(this));

  onMsg(this, function(type, msg) {
    if (type === 'close') {
      this.off();
      delete this.inflight;
      return;
    }
    if (!msg) {
      return;
    }
    if (msg.type === 'method') {
      if (inflight[msg.reqId]) {
        var deferred = inflight[msg.reqId];
        delete inflight[msg.reqId];
        deferred.resolve(msg.value);
      } else {
        console.log('Dropped response message with id ' + msg.reqId);
      }
    } else if (msg.type === 'event') {
      if (events[msg.name]) {
        emitter(msg.name, fdom.proxy.conform(events[msg.name].value, msg.value));
      }
    }
  }.bind(this));

  emit({
    'type': 'construct'
  });
};

/**
 * Force a collection of values to look like the types and length of an API template.
 */
fdom.proxy.conform = function(template, value) {
  if (typeof(value) === 'function') {
    value = undefined;
  }
  switch(template) {
  case 'string':
    return String('') + value;
  case 'number':
    return Number(1) * value;
  case 'bool':
    return Boolean(value === true);
  case 'object':
    // TODO(willscott): Allow removal if sandboxing enforces this.
    return JSON.parse(JSON.stringify(value));
  case 'blob':
    return value instanceof Blob ? value : new Blob([]);
  case 'buffer':
    return value instanceof ArrayBuffer ? value : new ArrayBuffer(0);
  case 'data':
    // TODO(willscott): should be opaque to non-creator.
    return value;
  case 'proxy':
    if (Array.isArray(value)) {
      return value;
    } else {
      // TODO: make proxy.
      return value;
    }
  }
  var val, i;
  if (Array.isArray(template)) {
    val = [];
    i = 0;
    if (template.length === 2 && template[0] === 'array') {
      //console.log("template is array, value is " + JSON.stringify(value));
      for (i = 0; i < value.length; i += 1) {
        val.push(fdom.proxy.conform(template[1], value[i]));
      }
    } else {
      for (i = 0; i < template.length; i += 1) {
        if (value[i] === null || value[i]) {
          val.push(fdom.proxy.conform(template[i], value[i]));
        } else {
          val.push(undefined);
        }
      }
    }
    return val;
  } else if (typeof template === 'object') {
    val = {};
    eachProp(template, function(prop, name) {
      if (value[name]) {
        val[name] = fdom.proxy.conform(prop, value[name]);
      }
    });
    return val;
  }
  fdom.debug.log('Conform ignoring value for template:' + template);
  fdom.debug.log(value);
};

/**
 * Recursively traverse a [nested] object and freeze its keys from being writable.
 * Note, the result can have new keys added to it, but existing ones cannot be overwritten.
 * Doesn't do anything for arrays or other collections.
 * 
 * @method recursiveFreezeObject
 * @static
 * @param {Object} obj - object to be frozen
 * @return {Object} obj
 **/
fdom.proxy.recursiveFreezeObject = function(obj) {
  var k, ret = {};
  if (typeof obj !== 'object') {
    return obj;
  }
  for (k in obj) {
    if (obj.hasOwnProperty(k)) {
      Object.defineProperty(ret, k, {
        value: fdom.proxy.recursiveFreezeObject(obj[k]),
        writable: false
      });
    }
  }
  return ret;
};
/*globals fdom:true, handleEvents, eachProp, Blob, ArrayBuffer */
/*jslint indent:2, white:true, node:true, sloppy:true, browser:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}
fdom.proxy = fdom.proxy || {};

/**
 * Note: this follows the structure of jQuery deferred
 * https://github.com/jquery/jquery/blob/master/src/deferred.js
 */

fdom.proxy.Callbacks = function(multiple) {
  var memory, fired, firing, firingStart, firingLength, firingIndex,
      stack = multiple && [],
      list = [],
      fire = function(data) {
    memory = data;
    fired = true;
    firingIndex = firingStart || 0;
    firingStart = 0;
    firingLength = list.length;
    firing = true;
    for (list; list && firingIndex < firingLength; firingIndex += 1) {
      list[firingIndex].apply(data[0], data[1]);
    }
    firing = false;
    if (list) {
      if (stack && stack.length) {
        fire(stack.shift());
      } else if (!stack) {
        list = [];
      }
    }
  },
  self = {
    add: function() {
      if (list) {
        var start = list.length;
        (function add(args) {
          var i;
          for (i = 0; i < args.length; i += 1) {
            if (typeof args[i] === 'function') {
              if (!self.has(args[i])) {
                list.push(args[i]);
              }
            } else if (args[i] && args[i].length && typeof args[i] !== 'string') {
              add(args[i]);
            }
          }
        })(arguments);
        if (firing) {
          firingLength = list.length;
        } else if (memory) {
          firingStart = start;
          fire(memory);
        }
      }
      return this;
    },
    remove: function() {
      var i, idx;
      if (list) {
        for (i = 0; i < arguments.length; i += 1) {
          while ((idx = list.indexOf(arguments[i], idx)) > -1) {
            list.splice(idx, 1);
            if (firing) {
              if (idx <= firingLength) {
                firingLength -= 1;
              }
              if (idx <= firingIndex) {
                firingIndex -= 1;
              }
            }
          }
        }
      }
      return this;
    },
    has: function(fn) {
      return fn ? list.indexOf(fn) > -1 : !!(list && list.length);
    },
    empty: function() {
      list = [];
      return this;
    },
    disable: function() {
      list = stack = memory = undefined;
      return this;
    },
    disabled: function() {
      return !list;
    },
    lock: function() {
      stack = undefined;
      return this;
    },
    locked: function() {
      return !stack;
    },
    fireWith: function(context, args) {
      args = args || [];
      args = [context, args.slice ? args.slice() : args];
      if (list && (!fired || stack)) {
        if (firing) {
          stack.push(args);
        } else {
          fire(args);
        }
      }
      return this;
    },
    fire: function() {
      self.fireWith(this, arguments);
      return this;
    },
    fired: function() {
      return !!fired;
    }
  };
  return self;
};

fdom.proxy.Deferred = function(func) {
  /* jshint -W083 */
  var events = [
    ["resolve", "done", fdom.proxy.Callbacks(), "resolved"],
    ["reject", "fail", fdom.proxy.Callbacks(), "rejected"],
    ["notify", "progress", fdom.proxy.Callbacks(true)]
  ], 
      deferred = {},
      state = "pending",
      promise = {
    'state': function() {
      return state;
    },
    'always': function() {
      deferred.done(arguments).fail(arguments);
      return this;
    },
    'then': function() {
      var fns = arguments, i;
      return fdom.proxy.Deferred(function(newDefer) {
        for (i = 0; i < events.length; i += 1) {
          var action = events[i][0],
              fn = typeof fns[i] === 'function' ? fns[i] : null;
          deferred[events[i][1]](function(fn, action) {
            var returned = fn && fn.apply(this, Array.prototype.slice.call(arguments, 2));
            if (returned && typeof returned.promise === 'function') {
              returned['promise']()
                .done(newDefer.resolve)
                .fail(newDefer.reject)
                .progress(newDefer.notify);
            } else {
              newDefer[action + "With"](this === promise ? newDefer['promise'](): this, fn ? [returned] : arguments);
            }
          }.bind(this, fn, action));
        }
        fns = null;
      })['promise']();
    },
    'promise': function(obj) {
      return (obj !== null && obj !== undefined) ? mixin(obj, promise) : promise;
    }
  };

  // Add event handlers.
  for (var i = 0; i < events.length; i++) {
    var stateStr = events[i][3];
    var list = events[i][2];

    promise[events[i][1]] = list.add;

    if (stateStr) {
      list.add(function(ss) {
        state = ss;
      }.bind(this, stateStr), events[i ^ 1][2].disable, events[2][2].lock);
    }

    var e = events[i][0];    
    deferred[e] = function(ev) {
      deferred[ev + "With"](this === deferred ? promise : this, Array.prototype.slice.call(arguments, 1));
      return this;
    }.bind(this, e);
    deferred[e + "With"] = list.fireWith;
  }

  promise['promise'](deferred);
  if (func) {
    func.call(deferred, deferred);
  }
  return deferred;
};
/*globals fdom:true, handleEvents */
/*jslint indent:2, white:true, node:true, sloppy:true, browser:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}
fdom.proxy = fdom.proxy || {};

fdom.proxy.EventInterface = function(onMsg, emit) {
  handleEvents(this);
  
  onMsg(this, function(emit, type, msg) {
    emit(msg.type, msg.message);
  }.bind(this, this.emit));

  this.emit = function(emitter, type, msg) {
    emitter({type: type, message: msg}, true);
  }.bind({}, emit);
};
fdom.apis.set("core", {
  'createChannel': {type: "method", value: []},
  'bindChannel': {type: "method", value: ["proxy"]},
  'getId': {type: "method", value: []}
});

fdom.apis.set("core.view", {
  'open': {type: "method", value: ["string", {
    'file':"string",
    'code':"string"
  }]},
  'show': {type: "method", value: []},
  'close': {type: "method", value: []},
  'postMessage': {type: "method", value: ["object"]},

  'message': {type: "event", value: "object"},
  'onClose': {type: "event", value: []}
});

fdom.apis.set("core.storage", {
  'keys': {type: "method", value: []},
  'get': {type: "method", value: ["string"]},
  'set': {type: "method", value: ["string", "string"]},
  'remove': {type: "method", value: ["string"]},
  'clear': {type: "method", value: []}
});

fdom.apis.set("core.socket", {
  'create': {type: "method", value: ["string", "object"]},
  'connect': {type: "method", value: ["number", "string", "number"]},
  'onData': {type: "event", value: {"socketId": "number", "data": "buffer"}},
  'write': {type: "method", value: ["number", "buffer"]},
  'disconnect': {type: "method", value: ["number"]},
  'destroy': {type: "method", value: ["number"]},
  'listen': {type: "method", value: ["number", "string", "number"]},
  'onConnection': {type: "event", value: {
    "serverSocketId": "number",
    "clientSocketId": "number"}},
  'getInfo': {type: "method", value: ["number"]}
});

fdom.apis.set("core.runtime", {
  'createApp': {type: "method", value: ["string", "proxy"]},
  'resolve': {type: "method", value: ["string", "string"]},
  'needFile': {type: 'event', value: ["string", "string"]}
});

fdom.apis.set("core.peerconnection", {
  'setup': {type: "method", value: ["name", "proxy"]},
  'send': {type: "method", value: [{"tag": "string", "text": "string", "binary": "blob", "buffer": "buffer"}]},
  'openDataChannel': {type: "method", value: ["string"]},
  'closeDataChannel': {type: "method", value: ["string"]},
  'close': {type: "method", value: []},

  'onData': {type: "event", value: {"tag": "string", "text": "string", "binary": "blob", "buffer": "buffer"}},
  'onClose': {type: "event", value: {}}
});

fdom.apis.set('core.echo', {
  'setup': {type: "method", value: ["proxy"]},
  'send': {type: "method", value: ["string"]},
  'message': {type: "event", value: "string"}
});


fdom.apis.set('core.sctp-peerconnection', {
  // Setup the link to the peer and options for this peer connection.
  'setup': {type: "method",
    value: [
      // The 'proxy' object is a freedom channel identifier used to send/receive
      // text messages to/from a signalling chanel.
      "proxy",
      // The peerName, used debugging and console messages.
      "string",
      ]
  },

  // Send a message to the peer.
  'send': {type: "method", value: [{
    // Data channel id. If provided, will be used as the channel label.
    // If the channel label doesn't already exist, a new channel will be
    // created.
    "channelLabel": "string",
    // One of the bellow should be defined; this is the data to send.
    "text": "string",
    "binary": "blob",
    "buffer": "buffer"
  }]},

  // Called when we get a message from the peer.
  'onReceived': {type: "event", value: {
    // The label/id of the data channel.
    "channelLabel": "string",
    // One the below will be specified.
    "text": "string",
    "binary": "blob",
    "buffer": "buffer"
  }},

  // Open the data channel with this label.
  'openDataChannel': {type: "method", value: ["string"]},
  // Close the data channel with this label.
  'closeDataChannel': {type: "method", value: ["string"]},

  // A channel with this id has been opened.
  'onOpenDataChannel': {type: "event", value: {"channelId": "string"}},
  // The channale with this id has been closed.
  'onCloseDataChannel': {type: "event", value: {"channelId": "string"}},

  // Close the peer connection.
  'close': {type: "method", value: []},
  // The peer connection has been closed.
  'onClose': {type: "event", value: {}},
});

/**
 * SOCIAL API
 *
 * API for connecting to social networks and messaging of users.
 * Note that the following properties depend on the specific implementation (provider)
 * behind this API that you choose.
 * Depending on the Social provider, it may also expose multiple networks simultaneously.
 * In this case, you may 'login' to each separately and receive multiple <user cards> for yourself.
 * Note that the network identifier will be exposed in 'onStatus' events.
 * It is highly advised to react to 'onStatus' events, as opposed to hardcoding in network identifiers,
 * as these identifiers are subject to change.
 *
 * Variable properties dependent on choice of provider:
 * - Edges in the social network (who is on your roster)
 * - Reliable message passing (or unreliable)
 * - In-order message delivery (or out of order)
 * - Persistent clientId - Whether your clientId changes between logins when
 *    connecting from the same device
 *
 * Invariants across all providers:
 * - The userId for each user does not change between logins
 * - The Social provider should output an 'onStatus' event upon initialization (after constructor)
 *   with its current state.
 *
 * Define a <client card>, as the following:
 * - Information related to a specific device or client of a user
 * {
 *   'clientId': 'string',  // Unique ID of client (e.g. alice@gmail.com/Android-23nadsv32f)
 *   'network': 'string',   // Name of network this client is logged into
 *   'status': 'number'     // Status of the client. See the 'STATUS_CLIENT' constants
 * }
 *
 * Define a <user card>, as the following:
 * - Information related to a specific user, who may have multiple client devices
 * {
 *    'userId': 'string',   // Unique ID of user (e.g. alice@gmail.com)
 *    'name': 'string',     // Name (e.g. Alice Underpants)
 *    'url': 'string',      // Homepage URL
 *    'imageData': 'string',// Data URI of image data (e.g. data:image/png;base64,adkwe329...)
 *    'clients': {          // List of clients indexed by their clientId
 *      'client1': <client card>, 
 *      'client2': <client card>,
 *      ...
 *    }
 * }
 **/

fdom.apis.set('social', {
  /** 
   * List of error codes that can be returned in 'onStatus'
   * events. Because 'login' and 'logout' methods turn 'onStatus'
   * events, those use the same codes
  **/
  'STATUS_NETWORK': {type: 'constant', value: {
    // Not connected to any social network.
    // There are no guarantees other methods or events will work until
    // the user calls 'login'
    'OFFLINE': 0,
    // Fetching login credentials or authorization tokens
    'AUTHENTICATING': 1,
    // Connecting to the social network
    'CONNECTING': 2,
    // Online!
    'ONLINE': 3,
    // Error with authenticating to the server
    'ERR_AUTHENTICATION': -1,
    // Error with connecting to the server
    'ERR_CONNECTION': -2
  }},
  
  /**
   * List of possible statuses in the <client card>
   **/
  'STATUS_CLIENT': {type: 'constant', value: {
    // Not logged in
    'OFFLINE': 0,
    // This client is online, but does not run the same app
    // (i.e. can be useful to invite others to your FreeDOM app)
    'ONLINE': 1,
    // This client runs the same FreeDOM app as you and is online
    'MESSAGEABLE': 2
  }},

  /**
   * Stores a list of your userId's
   * NOTE: This is not yet implemented because 'property' is not working
   * e.g. var id = social.id
   **/
  'id': {type: 'property', value: ['string']},

  /**
   * Log into the network (See below for parameters)
   * e.g. social.login(Object options)
   *
   * @method login
   * @param {Object} loginOptions - See below
   * @return {Object} status - Same schema as 'onStatus' events
   **/
  'login': {type: 'method', value: [{
    'network': 'string',  //Network name (as emitted by 'onStatus' events)
    'agent': 'string',    //Name of the application
    'version': 'string',  //Version of application
    'url': 'string',      //URL of application
    'interactive': 'bool' //Prompt user for login if credentials not cached?
  }]},

  /**
   * Returns all the <user card>s that we've seen so far (from 'onChange' events)
   * Note: the user's own <user card> will be somewhere in this list
   * e.g. social.getRoster();
   *
   * @method getRoster
   * @return {Object} { List of <user cards> indexed by userId
   *    'userId1': <user card>,
   *    'userId2': <user card>,
   *     ...
   * }
   **/
  'getRoster': {type: 'method', value: []},

  /** 
   * Send a message to user on your network
   * If the message is sent to a userId, it is sent to all clients
   * If the message is sent to a clientId, it is sent to just that one client
   * If the destination is not specified or invalid, the message is dropped
   * e.g. sendMessage(String destination_id, String message)
   * 
   * @method sendMessage
   * @param {String} destination_id - target
   * @param {String} message
   * @return nothing
   **/
  'sendMessage': {type: 'method', value: ['string', 'string']},

  /**
   * Logs out the specific user of the specified network
   * If userId is null, but network is not - log out of all accounts on that network
   * If networkName is null, but userId is not - log out of that account
   * If both fields are null, log out of all accounts on all networks
   * e.g. logout(Object options)
   * 
   * @method logout
   * @param {Object} logoutOptions - see below 
   * @return {Object} status - same schema as 'onStatus' events
   **/
  'logout': {type: 'method', value: [{
    'network': 'string',  // Network to log out of
    'userId': 'string'    // User to log out
  }]},

  /**
   * Event that is sent on changes to a <user card> 
   * (for either yourself or one of your friends)
   * This event must match the schema for an entire <user card> (see above)
   * 
   * Current contract is that clients grows monotonically, when clients go
   * offline, they are kept in the clients and have |status| "offline".
   **/
  'onChange': {type: 'event', value: {
    'userId': 'string',     // Unique identifier of the user (e.g. alice@gmail.com)
    'name': 'string',       // Display name (e.g. Alice Foo)
    'url': 'string',        // Homepage URL (e.g. https://alice.com)
    'imageData': 'string',  // Data URI of image binary (e.g. data:image/png;base64,adkwe3...)
    'clients': 'object'     // List of clients keyed by clientId
  }},

  /**
   * Event on incoming messages
   **/
  'onMessage': {type: 'event', value: {
    'fromUserId': 'string',   // userId of user message is from
    'fromClientId': 'string', // clientId of user message is from
    'toUserId': 'string',     // userId of user message is to
    'toClientId': 'string',   // clientId of user message is to
    'network': 'string',      // the network id the message came from.
    'message': 'string'       // message contents
  }},

  /**
   * Events describing the connection status of a particular network
   * NOTE: userId is not guaranteed to be present
   * e.g. if status == ONLINE | CONNECTING, it should be present
   *      if status == OFFLINE, it could be missing if the user hasn't logged in yet
   *                     if could be present if the user just logged off
   * All other parameters are always there.
   **/
  'onStatus': {type: 'event', value: {
    'network': 'string',  // Name of the network (chosen by social provider)
    'userId': 'string',   // userId of myself on this network
    'clientId': 'string', // clientId of my client on this network
    'status': 'number',   // One of the constants defined in 'STATUS_NETWORK'
    'message': 'string'   // More detailed message about status
  }}

});

/**
 * STORAGE API
 *
 * API for Persistent Storage
 * Exposes a key-value get/put interface
 **/
fdom.apis.set("storage", {
  /**
   * Fetch an array of all keys
   * e.g. storage.keys() => [string]
   *
   * @method keys
   * @return an array with all keys in the store 
   **/ 
  'keys': {type: "method", value: []},

  /**
   * Fetch a value for a key
   * e.g. storage.get(String key) => string
   *
   * @method get
   * @param {String} key - key to fetch
   * @return {String} Returns a string with the value, null if doesn't exist
   **/
  'get': {type: "method", value: ["string"]},

  /**
   * Sets a value to a key
   * e.g. storage.set(String key, String value)
   *
   * @method set
   * @param {String} key - key of value to set
   * @param {String} value - value
   * @return nothing
   **/
  'set': {type: "method", value: ["string", "string"]},
  
  /**
   * Removes a single key
   * e.g. storage.remove(String key)
   *
   * @method remove
   * @param {String} key - key to remove
   * @return nothing
   **/
  'remove': {type: "method", value: ["string"]},
  
  /**
   * Removes all data from storage
   * e.g. storage.clear()
   *
   * @method clear
   * @return nothing
   **/
  'clear': {type: "method", value: []}

});
/**
 * TRANSPORT API
 *
 * API for peer-to-peer communication
 * Useful for sending large binary data between instances
 **/
fdom.apis.set("transport", {
  /**
   * Prepare a P2P connection with initialization parameters
   * Takes in a signalling pathway (freedom.js channel), which is used
   * by the transport provider to send/receive signalling messages
   * to the other side of the P2P connection for setup.
   *
   * @method setup
   * @param {string} name - give this connection a name for logging
   * @param {proxy} channel - signalling channel
   * @return {channel} - a channel which the calling module must use to
   *    forward signalling messages (e.g. through a the Social API)
   **/ 
  'setup': {type: "method", value: ["string", "proxy"]},

  /**
   * Send binary data to the peer
   * All data is labelled with a string tag
   * Any data sent with the same tag is sent in order,
   * but there is no guarantees between tags
   *
   * @method send
   * @param {string} tag
   * @param {buffer} data
   * @return nothing
   **/
  'send': {type: "method", value: ["string", "buffer"]},

  /**
   * Close the connection
   * 
   * @method close
   * @return nothing
   **/
  'close': {type: "method", value: []},

  /**
   * Event on incoming data (ArrayBuffer)
   **/
  'onData': {type: "event", value: {
    "tag": "string",
    "data": "buffer"
  }},

  /**
   * Event on successful closing of the connection
   **/
  'onClose': {type: "event", value: []}
});
/*globals fdom:true, getId */
/*jslint indent:2,white:true,sloppy:true,sub:true */


/**
 * Core freedom services available to all modules.
 * Created by a local manager in response to a 'core' request.
 * @Class Core_unprivileged
 * @constructor
 * @param {Port.Manager} manager The manager this core is connected with.
 * @private
 */
var Core_unprivileged = function(manager) {
  this.manager = manager;
};

Core_unprivileged.unboundChannels = {};

Core_unprivileged.contextId = undefined;

/**
 * Create a custom channel.
 * Returns the structure {channel: fdom.proxy.Deferred, identifier: Object},
 * where the identifier can be 'redeemed' by another module or provider using
 * bind channel, at which point the deferred object will resolve with a channel
 * between the two endpoints.
 * @method createChannel
 * @params {Function} continuation Method to call with the cosntructed structure.
 */
Core_unprivileged.prototype.createChannel = function(continuation) {
  var proxy = new fdom.port.Proxy(fdom.proxy.EventInterface),
      deferred = fdom.proxy.Deferred(),
      id = getId(),
      chan = this.getChannel(proxy);
  this.manager.setup(proxy);

  if (this.manager.delegate && this.manager.toDelegate['core']) {
    this.manager.emit(this.manager.delegate, {
      type: 'Delegation',
      request: 'handle',
      flow: 'core',
      message: {
        type: 'register',
        id: id
      }
    });
  }
  Core_unprivileged.unboundChannels[id] = {
    local: true,
    proxy: proxy
  };

  proxy.once('start', function(deferred, proxy) {
    deferred.resolve(this.getChannel(proxy));
  }.bind(this, deferred, proxy));

  continuation({
    channel: chan,
    identifier: id
  });
};

Core_unprivileged.prototype.getChannel = function(proxy) {
  var iface = proxy.getProxyInterface(),
      chan = iface();
  chan.close = iface.close;
  chan.onClose = iface.onClose;
  iface.onClose(chan, function() {
    proxy.doClose();
  });
  return chan;
};

/**
 * Receive a message from another core instance.
 * Note: Core_unprivileged is not registered on the hub. it is a provider,
 *     as it's location and name would indicate. This function is called by
 *     port-app to relay messages up to higher levels.  More generally, the
 *     messages emitted by the core to 'this.manager.emit(this.mananage.delegate'
 *     Should be onMessaged to the controlling core.
 * @param {String} source The source of the message.
 * @param {Object} msg The messsage from an isolated core provider.
 */
Core_unprivileged.prototype.onMessage = function(source, msg) {
  if (msg.type === 'register') {
    Core_unprivileged.unboundChannels[msg.id] = {
      remote: true,
      resolve: msg.reply,
      source: source
    };
  } else if (msg.type === 'clear') {
    delete Core_unprivileged.unboundChannels[msg.id];
  } else if (msg.type === 'bind') {
    if (Core_unprivileged.unboundChannels[msg.id]) {
      this.bindChannel(msg.id, function() {}, source);
    }
  }
};

/**
 * Bind a custom channel.
 * Creates a proxy interface to the custom channel, which will be bound to
 * the proxy obtained through an earlier createChannel call.
 * channel to a proxy.
 * @method bindChannel
 * @param {Object} identifier An identifier obtained through createChannel.
 * @param {Function} continuation A function to be called with the proxy.
 */
Core_unprivileged.prototype.bindChannel = function(identifier, continuation, source) {
  var toBind = Core_unprivileged.unboundChannels[identifier],
      newSource = !source;

  // when bindChannel is called directly, source will be undefined.
  // When it is propogated by onMessage, a source for binding will already exist.
  if (newSource) {
    fdom.debug.log('making local proxy for core binding');
    source = new fdom.port.Proxy(fdom.proxy.EventInterface);
    this.manager.setup(source);
  }

  // If this is a known identifier and is in the same context, binding is easy.
  if (toBind && toBind.local) {
    fdom.debug.log('doing local binding with ' + source);
    this.manager.createLink(source, identifier, toBind.proxy, 'default');
    delete Core_unprivileged.unboundChannels[identifier];
    if (this.manager.delegate && this.manager.toDelegate['core']) {
      this.manager.emit(this.manager.delegate, {
        type: 'Delegation',
        request: 'handle',
        flow: 'core',
        message: {
          type: 'clear',
          id: identifier
        }
      });
    }
  } else if (toBind && toBind.remote) {
    fdom.debug.log('doing remote binding downward');
    this.manager.createLink(
        source,
        newSource ? 'default' : identifier,
        toBind.source,
        identifier);
    toBind.resolve({
      type: 'Bind Channel',
      request:'core',
      flow: 'core',
      message: {
        type: 'bind',
        id: identifier
      }
    });
    delete Core_unprivileged.unboundChannels[identifier];
  } else if (this.manager.delegate && this.manager.toDelegate['core']) {
    fdom.debug.warn('delegating bind request for unseen ID:' + identifier);
    this.manager.emit(this.manager.delegate, {
      type: 'Delegation',
      request: 'handle',
      flow: 'core',
      message: {
        type: 'bind',
        id: identifier
      }
    });
    source.once('start', function(p, cb) {
      cb(this.getChannel(p));
    }.bind(this, source, continuation));
    this.manager.createLink(source,
        'default',
        this.manager.hub.getDestination(this.manager.delegate),
        identifier);
    delete Core_unprivileged.unboundChannels[identifier];
    return;
  } else {
    fdom.debug.warn('Asked to bind unknown channel: ' + identifier);
    fdom.debug.log(Core_unprivileged.unboundChannels);
    continuation();
    return;
  }

  if (source.getInterface) {
    continuation(this.getChannel(source));
  } else {
    continuation();
  }
};

/**
 * Get the ID of the current freedom.js context.  Provides an
 * array of module URLs, the lineage of the current context.
 * When not in an application context, the ID is the lineage
 * of the current View.
 * @method getId
 * @param {Function} callback The function called with ID information.
 */
Core_unprivileged.prototype.getId = function(callback) {
  // TODO: make sure contextID is properly frozen.
  callback(Core_unprivileged.contextId);
};

/**
 * Set the ID of the current freedom.js context.
 * @method setId
 * @private
 * @param {String[]} id The lineage of the current context.
 */
Core_unprivileged.prototype.setId = function(id) {
  Core_unprivileged.contextId = id;
};

fdom.apis.register("core", Core_unprivileged);
/*globals fdom:true, handleEvents */
/*jslint indent:2,white:true,sloppy:true */

/**
 * A minimal provider implementing the core.echo interface for interaction with
 * custom channels.  Primarily used for testing the robustness of the custom
 * channel implementation.
 * @Class Echo_unprivileged
 * @constructor
 * @param {App} app The application creating this provider.
 */
var Echo_unprivileged = function(app) {
  fdom.debug.log('Echo Created!');
  this.app = app;
  handleEvents(this);

  // The Core object for managing channels.
  this.app.once('core', function(Core) {
    this.core = new Core();
  }.bind(this));
  this.app.emit(this.app.controlChannel, {
    type: 'core request delegated to echo',
    request: 'core'
  });
};

/**
 * Setup the provider to echo on a specific proxy. Subsequent messages
 * From the custom channel bound here will be re-emitted as a message
 * from the provider.  Subsequent messages to the provider will be
 * emitted on the bound channel.
 * @param {Object} proxy The identifier for the custom channel to bind.
 * @param {Function} continuation Function to call when setup is complete.
 * @method setup
 */
Echo_unprivileged.prototype.setup = function(proxy, continuation) {
  continuation();
  if (!this.core) {
    this.dispatchEvent('message', 'no core available to setup proxy with at echo');
    return;
  }

  this.core.bindChannel(proxy, function(chan) {
    if (this.chan) {
      this.chan.close();
    }
    this.chan = chan;
    this.chan.onClose(function() {
      delete this.chan;
    }.bind(this));
    this.dispatchEvent('message', 'channel bound to echo');
    this.chan.on('message', function(m) {
      this.dispatchEvent('message', 'from custom channel: ' + m);
    }.bind(this));
  }.bind(this));
};

/**
 * Send a message to the bound custom channel.
 * @param {String} str The string to send.
 * @param {Function} continuation Function to call when sending is complete.
 * @method send
 */
Echo_unprivileged.prototype.send = function(str, continuation) {
  continuation();
  if (this.chan) {
    this.chan.emit('message', str);
  } else {
    this.dispatchEvent('message', 'no channel available');    
  }
};

fdom.apis.register("core.echo", Echo_unprivileged);
/**
 * A freedom.js interface to WebRTC Peer Connections
 * @param Channel channel a channel for emitting events.
 * @constructor
 * @private
 */
var PeerConnection_unprivileged = function(channel) {
  this.appChannel = channel;
  this.dataChannel = null;
  this.identity = null;
  this.connection = null;
  this.myPid = Math.random();
  this.remotePid = 1;
  this.sendQueue = [];
  handleEvents(this);
};

PeerConnection_unprivileged.prototype.open = function(proxy, continuation) {
  if (this.connection) {
    continuation(false);
  }

  // Listen for messages to/from the provided message channel.
  this.appChannel = Core_unprivileged.bindChannel(this.appChannel, proxy);
  this.appChannel['on']('message', this.onIdentity.bind(this));
  this.appChannel.emit('ready');

  this.setup(true);
  continuation();
};

PeerConnection_unprivileged.prototype.setup = function(initiate) {
  var RTCPeerConnection = RTCPeerConnection || webkitRTCPeerConnection || mozRTCPeerConnection;
  this.connection = new RTCPeerConnection(null, {'optional': [{'RtpDataChannels': true}]});

  var dcSetup = function() {
    this.dataChannel.addEventListener('open', function() {
      console.log("Data channel opened.");
      this.emit('open');
    }.bind(this), true);
    this.dataChannel.addEventListener('message', function(m) {
      // TODO(willscott): Support native binary transport, rather than this mess
      if (this.parts > 0) {
        this.buf += m.data;
        this.parts--;
        console.log('waiting for ' + this.parts + ' more parts.');
        if (this.parts === 0) {
          console.log("binary data recieved (" + this.buf.length + " bytes)");
          var databuf = JSON.parse(this.buf);
          var arr = new Uint8Array(databuf['binary']);
          var blob = new Blob([arr.buffer], {"type": databuf['mime']});
          this['dispatchEvent']('message', {"tag": databuf['tag'], "binary": blob, "buffer" : arr.buffer});
          this.buf = "";
        }
        return;
      }
      var data = JSON.parse(m.data);
      if (data['text']) {
        this['dispatchEvent']('message', {"tag": data['tag'], "text": data['text']});
      } else {
        this.parts = data['binary'];
        console.log("Beginning receipt of binary data (" + this.parts + " parts)");
        this.buf = "";
      }
    }.bind(this), true);
    this.dataChannel.addEventListener('close', function(conn) {
      if (this.connection == conn) {
        this['dispatchEvent']('onClose');
        this.close(function() {});
      }
    }.bind(this, this.connection), true);
  }.bind(this);

  if (initiate) {
    this.dataChannel = this.connection.createDataChannel("sendChannel", {'reliable': false});
    dcSetup();
  } else {
    this.connection.addEventListener('datachannel', function(evt) {
      this.dataChannel = evt['channel'];
      dcSetup();
    }.bind(this));
  }

  this.connection.addEventListener('icecandidate', function(evt) {
    if(evt && evt['candidate']) {
      this.appChannel.emit('message', JSON.stringify(evt['candidate']));
    }
  }.bind(this), true);

  this.makeOffer();
};

PeerConnection_unprivileged.prototype.makeOffer = function() {
  if (this.remotePid < this.myPid) {
    return;
  }
  this.connection.createOffer(function(desc) {
    this.connection.setLocalDescription(desc);
    desc['pid'] = this.myPid;
    this.appChannel.emit('message', JSON.stringify(desc));
  }.bind(this));
};

PeerConnection_unprivileged.prototype.makeAnswer = function() {
  this.connection.createAnswer(function(desc) {
    this.connection.setLocalDescription(desc);
    desc['pid'] = this.myPid;
    this.appChannel.emit('message', JSON.stringify(desc));
  }.bind(this));
};

PeerConnection_unprivileged.prototype.onIdentity = function(msg) {
  try {
    var m = msg;
    if (typeof msg === "string") {
      m = JSON.parse(msg);
    }
    if (m['candidate']) {
      var candidate = new RTCIceCandidate(m);
      this.connection.addIceCandidate(candidate);
    } else if (m['type'] == 'offer' && m['pid'] != this.myId) {
      this.remotePid = m['pid'];
      if (this.remotePid < this.myPid) {
        this.close(function() {
          this.setup(false);
          this.connection.setRemoteDescription(new RTCSessionDescription(m), function() {}, function() {
            console.log("Failed to set remote description");
          });
          this.makeAnswer();
        }.bind(this));
      } else {
        // They'll get my offer and send an answer.
      }
    } else if (m['type'] == 'answer' && m['pid'] != this.myId) {
      this.remotePid = m['pid'];
      this.connection.setRemoteDescription(new RTCSessionDescription(m));
    }
  } catch(e) {
    console.log("Couldn't understand identity message: " + JSON.stringify(msg) + ": -> " + e.message);
  }
};

PeerConnection_unprivileged.prototype.postMessage = function(ref, continuation) {
  if (!this.connection) {
    return continuation(false);
  }
  // Queue until open.
  if (!this.dataChannel || this.dataChannel.readyState != "open") {
    return this.once('open', this.postMessage.bind(this, ref, continuation));
  }
  window.dc = this.dataChannel;

  if(ref['text']) {
    this.sendQueue.push(JSON.stringify({"tag": ref['tag'], "text":ref['text']}));
    console.log("Sending text: " + ref['text']);
    this._process();
  } else if(ref['binary']) {
    // TODO(willscott): implement direct blob support when available.
    console.log("Transmitting " + ref['binary'].size + " binary bytes");
    var reader = new FileReader();
    reader.addEventListener('load', function(type, tag, ev) {
      var arr = [];
      arr.push.apply(arr, new Uint8Array(ev.target.result));
      // Chunk messages so that packets are below MTU.
      var MAX_LEN = 512;
      var str = JSON.stringify({"mime": type, "tag": tag, "binary": arr});
      var parts = Math.ceil(str.length / MAX_LEN);
      console.log("Sending chunked " + type + " ("+ str.length + " bytes)");
      this.sendQueue.push(JSON.stringify({"binary": parts}));

      while (str.length > 0) {
        this.sendQueue.push(str.substr(0, MAX_LEN));
        str = str.substr(MAX_LEN);
      }
      this._process();
    }.bind(this, ref['binary'].type, ref['tag']), true);

    reader.readAsArrayBuffer(ref['binary']);
  }
  continuation();
};

PeerConnection_unprivileged.prototype._process = function(scheduled) {
  if (this.scheduled && !scheduled) {
    return;
  }

  var next = this.sendQueue.shift();
  this.dataChannel.send(next);

  if (this.scheduled) {
    clearTimeout(this.scheduled);
    delete this.scheduled;
  }

  if (this.sendQueue.length) {
    var STEP = 300;
    this.scheduled = setTimeout(this._process.bind(this, true), STEP);
  }
};

PeerConnection_unprivileged.prototype.close = function(continuation) {
  delete this.dataChannel;

  if (this.connection) {
    try {
      this.connection.close();
    } catch(e) {
      // Ignore already-closed errors.
    }
    delete this.connection;
  }
  continuation();
};

fdom.apis.register("core.peerconnection", PeerConnection_unprivileged);
// A FreeDOM interface to a WebRTC Peer Connection via the peerdata wrapper.

// _signallingChannel is a channel for emitting events back to the freedom Hub.
function SctpPeerConnection(portApp) {

    // a (hopefully unique) ID for debugging.
  this.peerName = "p" + Math.random();

  // For debugging.
  window.datapeers = window.datapeers || {};
  window.datapeers[this.peerName] = this;

  // This is the portApp (defined in freedom/src/port-app.js). A way to speak
  // to freedom.
  this._portApp = portApp;

  // This is the a channel to send signalling messages.
  this._signallingChannel = null;

  // The DataPeer object for talking to the peer.
  this._peer = null;

  // The Core object for managing channels.
  this._portApp.once('core', function(Core) {
    this._core = new Core();
  }.bind(this));
  this._portApp.emit(this._portApp.controlChannel, {
    type: 'core request delegated to peerconnection',
    request: 'core'
  });
}

// Start a peer connection using the given freedomChannelId as the way to
// communicate with the peer. The argument |freedomChannelId| is a way to speak
// to an identity provide to send them SDP headers negotiate the address/port to
// setup the peer to peerConnection.
//
// options: {
//   peerName: string,   // For pretty printing messages about this peer.
//   debug: boolean           // should we add extra
// }
SctpPeerConnection.prototype.setup =
    function(signallingChannelId, peerName, continuation) {
  this.peerName = peerName;
  var self = this;

  var dataChannelCallbacks = {
    // onOpenFn is called at the point messages will actually get through.
    onOpenFn: function (smartDataChannel) {
/*      console.log(smartDataChannel.peerName + ": dataChannel(" +
        smartDataChannel.dataChannel.label +
        "): onOpenFn"); */
      self.dispatchEvent("onOpenDataChannel",
          smartDataChannel.dataChannel.label);
    },
    onCloseFn: function (smartDataChannel) {
/*      console.log(smartDataChannel.peerName + ": dataChannel(" +
        smartDataChannel.dataChannel.label +
        "): onCloseFn"); */
      self.dispatchEvent("onCloseDataChannel",
                         { channelId: smartDataChannel.dataChannel.label});
    },
    // Default on real message prints it to console.
    onMessageFn: function (smartDataChannel, event) {
      // These were filling the console, and causing the console to
      // hog the CPU.
/*      console.log(smartDataChannel.peerName + ": dataChannel(" +
          smartDataChannel.dataChannel.label +
          "): onMessageFn", event); */
      if (event.data instanceof ArrayBuffer) {
        var data = new Uint8Array(event.data);
/*        console.log(smartDataChannel.peerName + ": dataChannel(" +
          smartDataChannel.dataChannel.label +
          "): " + "Got ArrayBuffer (onReceived) data: ", data); */
        self.dispatchEvent('onReceived',
            { 'channelLabel': smartDataChannel.dataChannel.label,
              'buffer': event.data });
      } else if (typeof(event.data) == 'string') {
/*        console.log(smartDataChannel.peerName + ": dataChannel(" +
          smartDataChannel.dataChannel.label +
          "): " + "Got string (onReceived) data: ", event.data); */
        self.dispatchEvent('onReceived',
            { 'channelLabel': smartDataChannel.dataChannel.label,
              'text': event.data });
      } else {
/*        console.error(smartDataChannel.peerName + ": dataChannel(" +
          smartDataChannel.dataChannel.label +
          "): " + "Got unkown data :( "); */
      }
    },
    // Default on error, prints it.
    onErrorFn: function(smartDataChannel, err) {
      console.error(smartDataChannel.peerName + ": dataChannel(" +
          smartDataChannel.dataChannel.label + "): error: ", err);
    }
  };

  this._peer = new DataPeer(this.peerName, dataChannelCallbacks);

  // Setup link between Freedom messaging and _peer's signalling.
  // Note: the signalling channel should only be sending receiveing strings.
  this._core.bindChannel(signallingChannelId, function(channel) {
    this._signallingChannel = channel;
    this._peer.setSendSignalMessage(
        this._signallingChannel.emit.bind(this._signallingChannel, "message"));
    this._signallingChannel.on('message',
        this._peer.handleSignalMessage.bind(this._peer));
    this._signallingChannel.emit('ready');
    continuation();
  }.bind(this));

};

// TODO: delay continuation until the open callback rom _peer is called.
SctpPeerConnection.prototype.openDataChannel =
    function(channelId, continuation) {
  this._peer.openDataChannel(channelId, continuation);
};

SctpPeerConnection.prototype.closeDataChannel =
    function(channelId, continuation) {
  this._peer.closeChannel(channelId);
  continuation();
};

// Called to send a message over the given datachannel to a peer. If the data
// channel doesn't already exist, the DataPeer creates it.
SctpPeerConnection.prototype.send = function(sendInfo, continuation) {
  var objToSend = sendInfo.text || sendInfo.buffer || sendInfo.binary;
  if (typeof objToSend === 'undefined') {
    console.error("No valid data to send has been provided.", sendInfo);
    return;
  }
  this._peer.send(sendInfo.channelLabel, objToSend, continuation);
};

SctpPeerConnection.prototype.shutdown = function(continuation) {
  this._peer.close();
  continuation();
};

fdom.apis.register('core.sctp-peerconnection', SctpPeerConnection);
/**
 * A FreeDOM core.storage provider that depends on localStorage
 * Thus, this only works in the context of a webpage and has
 * some size limitations.
 * Note that this can conflict with other scripts using localStorage
 * as keys are raw
 */
var Storage_unprivileged = function(app) {
  this.app = app;
  handleEvents(this);
};

Storage_unprivileged.prototype.keys = function(continuation) {
  var result = [];
  for (var i = 0; i < localStorage.length; i++) {
    result.push(localStorage.key(i));
  }
  continuation(result);
};

Storage_unprivileged.prototype.get = function(key, continuation) {
  try {
    var val = localStorage.getItem(key);
    continuation(val);
  } catch(e) {
    continuation(null);
  }
};

Storage_unprivileged.prototype.set = function(key, value, continuation) {
  localStorage.setItem(key, value);
  continuation();
};

Storage_unprivileged.prototype.remove = function(key, continuation) {
  localStorage.removeItem(key);
  continuation();
};

Storage_unprivileged.prototype.clear = function(continuation) {
  localStorage.clear();
  continuation();
};

/** REGISTER PROVIDER **/
fdom.apis.register("core.storage", Storage_unprivileged);
/**
 * A FreeDOM view is provided as a core service for displaying some UI.
 * Implementation is currently designed as a sandboxed iFrame that the
 * browser treats as a 'null' origin, whose sendMessage channel is
 * given to the provider.
 * @Class View_unprivileged
 * @constructor
 * @private
 * @param {App} app The application creating this provider.
 */
var View_unprivileged = function(app) {
  this.host = null;
  this.win = null;
  this.app = app;
  handleEvents(this);
};

/**
 * Ask for this view to open a specific location, either a File relative to
 * the loader, or an explicit code location.
 * @method open
 * @param {String} name The identifier of the view. Used to choose attachment.
 * @param {Object} what What UI to load.
 * @param {Function} continuation Function to call when view is loaded.
 */
View_unprivileged.prototype.open = function(name, what, continuation) {
  this.host = document.createElement("div");
  this.host.style.width = "100%";
  this.host.style.height = "100%";
  this.host.style.display = "relative";

  var container = document.body;
  var config = this.app.config.views;
  if (config && config[name] && document.getElementById(config[name])) {
    container = document.getElementById(config[name]);
  }

  container.appendChild(this.host);
  var root = this.host;
  // TODO(willscott): Support shadow root as available.
  // if (this.host['webkitCreateShadowRoot']) {
  //   root = this.host['webkitCreateShadowRoot']();
  // }
  var frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts allow-forms");
  if (what['file']) {
    fdom.resources.get(this.app.manifestId, what['file']).done(function(fname) {
      this.finishOpen(root, frame, fname, continuation);
    }.bind(this));
  } else if (what['code']) {
    this.finishOpen(root, frame, "data:text/html;charset=utf-8," + what['code'], continuation);
  } else {
    continuation(false);
  }
};

View_unprivileged.prototype.finishOpen = function(root, frame, src, continuation) {
  frame.src = src;
  frame.style.width = "100%";
  frame.style.height = "100%";
  frame.style.border = "0";
  frame.style.background = "transparent";
  root.appendChild(frame);

  this.app.config.global.addEventListener('message', this.onMessage.bind(this), true);

  this.win = frame;
  continuation({});
};

View_unprivileged.prototype.show = function(continuation) {
  continuation();
};

View_unprivileged.prototype.postMessage = function(args, continuation) {
  this.win.contentWindow.postMessage(args, '*');
  continuation();
};

View_unprivileged.prototype.close = function() {
  if (this.host) {
    this.host.parentNode.removeChild(this.host);
    this.host = null;
  }
  if (this.win) {
    removeEventListener('message', this.onMessage.bind(this), true);
    this.win = null;
  }
};

View_unprivileged.prototype.onMessage = function(m) {
  if (m.source == this.win.contentWindow) {
    this['dispatchEvent']('message', m.data);
  }
};

fdom.apis.register("core.view", View_unprivileged);

    // Create default context.
    global['freedom'] = setup(global, freedom_src);
  })();

})(this);

