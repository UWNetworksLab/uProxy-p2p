var VCARD_REQUEST_TIMEOUT = 3000;
var VCARD_THROTTLE_TIMEOUT = 500;
var chrome = {
  socket: freedom['core.socket']()
};

console.warn = function(f) {
  console.log(f);
};

var window = {};
var view = freedom['core.view']();
var storage = freedom['core.storage']();
//storage.clear();

function IdentityProvider() {
  //DEBUG
  window.current = this;
  console.log(NETWORK_NAME + self.location.href);

  this.client = null;
  this.credentials = null;
  this.loginOpts = null;
  this.vCardRequestTime = {};
  this.vCardRequestQueue = [];
  this.vCardFetchTime = new Date();

  this.status = 'offline';
  //dispatchEvent is not bound until after constructor
  setTimeout((function () {
    this.dispatchEvent('onStatus', {
      status: this.status, network: NETWORK_ID, message: "Init"
    });
  }).bind(this), 0);
  this.profile = {
    me: {},
    roster: {}
  };

  view.open({file: NETWORK_ID}).done(function() {
    view.show();
  });
};

IdentityProvider.prototype.login = function(opts, continuation) {
  this.loginOpts = opts;
  if (!this.credentials) {
    console.log("Identity provider authenticating");
    this.status = 'authenticating';
    this.dispatchEvent('onStatus', {
        status: this.status, network: NETWORK_ID, message: "OAuth2 Sequence"
    });
    view.once('message', function(opts, cont, message) {
      console.log("Identity Provider got credentials: " + JSON.stringify(message));
      if (message.cmd && message.cmd == 'auth') {
        this.credentials = message.message;
        this.login(opts, cont);
      } else if (message.cmd && message.cmd == 'error') {
        cont(this.onError(message.message));
      } else {
        cont(this.onError('Login: Unrecognized message from view - ' + JSON.stringify(message)));
      }
    }.bind(this, opts, continuation));
    view.postMessage({
      cmd: 'login',
      interactive: opts.interactive
    });
    return;
  } else if (!this.client) {
    console.log("Identity Provider connecting");
    var clientId = this.credentials.userId + '/' + this.loginOpts.agent;
    this.status = 'connecting';
    this.dispatchEvent('onStatus', {
        userId: this.credentials.userId,
        network: NETWORK_ID,
        status: this.status,
        message: "XMPP connect"
    });
    this.profile.me[this.credentials.userId] = {};
    this.profile.me[this.credentials.userId].userId = this.credentials.userId;
    this.profile.me[this.credentials.userId].clients = {};
    this.profile.me[this.credentials.userId].clients[clientId] = {
      clientId: clientId,
      network: NETWORK_ID,
      status: 'offline'
    };
    //Start XMPP client
    this.client = CONNECT(this.loginOpts.agent, this.credentials, (function(e) {
      continuation(this.onError(e));
    }).bind(this));
    this.client.addListener('online', (function() {
      continuation(this.onOnline());
    }).bind(this));
    this.client.addListener('error', (function(e) {
      continuation(this.onError(e));
    }).bind(this));
    if (this.client) { 
      this.client.addListener('stanza', this.onMessage.bind(this));
    }
  }
  //continuation();
};

IdentityProvider.prototype.getProfile = function(id, continuation) {
  //TODO get profiles for other users
  if (id === null || id === undefined) {
    continuation(this.profile);
  } else if (this.profile.me[id]) {
    continuation(this.profile);
  } else if (this.profile.roster[id]) {
    continuation({me: this.profile.roster[id], roster: {}});
  }
};

// Send a message to someone.
IdentityProvider.prototype.sendMessage = function(to, msg, continuation) {
  try {
    this.client.send(
        new window.XMPP.Element('message', {
          to: to,
          type: 'normal'
        }).c('body').t(msg));
  } catch (e) {
    console.error(e.stack);
  }
  continuation();
};


IdentityProvider.prototype.logout = function(userId, networkName, continuation) {
  //@TODO(ryscheng) debug, remove oAuth stuffies
  if (this.credentials && this.credentials.userId) {
    userId = this.credentials.userId;
  } else {
    userId = null;
  }
  view.postMessage({
    cmd: 'logout',
  });
  this.status = 'offline';
  var ret = {
      userId: userId,
      network: NETWORK_ID,
      status: this.status,
      message: 'Woo!'
  };
  this.dispatchEvent('onStatus', ret);
  if (this.profile.me[userId]) {
    this.profile.me[userId].clients = {};
    this.dispatchEvent('onChange', this.profile.me[userId]);
  }
  for (var id in this.profile.roster) {
    if (this.profile.roster.hasOwnProperty(id)) {
      this.profile.roster[id].clients = {};
      this.dispatchEvent('onChange', this.profile.roster[id]);
    }
  }
  this.credentials = null;
  if (this.client) {
    this.unannounce();
    this.client.end();
    this.client = null;
  }
  continuation(ret);
};


////////////////////////////////////
// INTERNAL METHODS
////////////////////////////////////

function getBaseJid(fullJid) {
  if (fullJid.indexOf('/') < 0) {
    return fullJid;
  } else {
    return fullJid.substring(0, fullJid.indexOf('/'));
  }
}

IdentityProvider.prototype.getAttr = function (fullJid, attr) {
  var baseJid = getBaseJid(fullJid);
  if (this.profile.me[baseJid] && this.profile.me[baseJid][attr]) {
    return this.profile.me[baseJid][attr];
  } else if (this.profile.roster[baseJid] && this.profile.roster[baseJid][attr]) {
    return this.profile.roster[baseJid][attr];
  } else {
    return null;
  }
};

IdentityProvider.prototype.sendChange = function (jid) {
  var baseJid = getBaseJid(jid);
  if (this.profile.me[baseJid]) {
    this.dispatchEvent('onChange', this.profile.me[baseJid]);
  } else if (this.profile.roster[baseJid]) {
    this.dispatchEvent('onChange', this.profile.roster[baseJid]);
  } else {
    console.error("Error - missing roster: "+baseJid);
  }
};

IdentityProvider.prototype.setAttr = function (fullJid, attr, value) {
  var baseJid = getBaseJid(fullJid);
  if (this.profile.me[baseJid]) {
    this.profile.me[baseJid][attr] = value;
  } else if (this.profile.roster[baseJid]) {
    this.profile.roster[baseJid][attr] = value;
  } else {
    this.profile.roster[baseJid] = {userId: baseJid};
    this.profile.roster[baseJid][attr] = value;
  }
  this.sendChange(baseJid);
};

IdentityProvider.prototype.setDeviceAttr = function (fullJid, attr, value) {
  var baseJid = getBaseJid(fullJid);
  var clientList = {};
  clientList[fullJid] = {clientId: fullJid, network: NETWORK_ID};
  if (this.profile.me[baseJid] && this.profile.me[baseJid].clients) {
    clientList = this.profile.me[baseJid].clients;
  } else if (this.profile.me[baseJid]) {
    this.profile.me[baseJid].clients = clientList;
  } else if (this.profile.roster[baseJid] && this.profile.roster[baseJid].clients) {
    clientList = this.profile.roster[baseJid].clients;
  } else if (this.profile.roster[baseJid]) {
    this.profile.roster[baseJid].clients = clientList;
  } else {
    this.profile.roster[baseJid] = {userId: baseJid, clients: clientList};
  }

  if (clientList[fullJid]) {
    clientList[fullJid][attr] = value;
  } else {
    clientList[fullJid] = {clientId: fullJid, network: NETWORK_ID};
    clientList[fullJid][attr] = value;
  }
  this.sendChange(baseJid);
};

IdentityProvider.prototype.onError = function(error) {
  console.log('Identity Login error');
  console.error(error);
  this.status = 'error';
  var ret = {
    userId: this.credentials.userId,
    network: NETWORK_ID,
    status: this.status,
    message: error
  };
  view.postMessage({
    cmd: 'logout',
  });
  
  if (this.client) {
    this.client.end();
    this.client = null;
  }
  this.dispatchEvent('onStatus', ret);
  this.credentials = null;
  return ret;
};

IdentityProvider.prototype.onOnline = function() {
  // Send first presence message
  this.announce();
  this.status = 'online';
  var ret = {
      userId: this.credentials.userId,
      network: NETWORK_ID,
      status: this.status,
      message: "Woo!"
  };
  this.dispatchEvent('onStatus',ret);
  // Get roster request (for names)
  this.client.send(new window.XMPP.Element('iq', {type: 'get'})
      .c('query', {'xmlns': 'jabber:iq:roster'}).up());
  // Get my own vCard
  this.getVCard(this.credentials.userId, 'unknown');
  // Update status
  var clients = this.profile.me[this.credentials.userId].clients;
  for (var k in clients) {
    if (clients.hasOwnProperty(k) && clients[k].clientId.indexOf(this.loginOpts.agent) >= 0) {
      clients[k].status = 'messageable';
    }
  }
  return ret;
};

IdentityProvider.prototype.announce = function () {
  this.client.send(new window.XMPP.Element('presence', {})
      .c("show").t("xa").up() // mark status of this client as 'extended away'.
      .c("c", { //  Advertise extended capabilities.
          xmlns: "http://jabber.org/protocol/caps",
          node: this.loginOpts.url,
          ver: this.loginOpts.version,
          hash: "fixed"
      }).up()
    //.c('priority').t("-127").up() // mark priority as low.
  );
  //this.client.send(new window.XMPP.Element('presence', {}));
};

IdentityProvider.prototype.unannounce = function() {
  if (this.client) {
    this.client.send(new window.XMPP.Element('presence', {type: 'unavailable'}));
  }
};

IdentityProvider.prototype.onRoster = function(stanza) {
  if (window.roster) {
    window.roster.push(stanza);
  } else {
    window.roster = [stanza];
  }
  //Expect result from roster 'get'
  var from = null;
  if (stanza.attrs.from) {
    from = stanza.attrs.from;
  } else {
    from = stanza.attrs.to;
  }
  var query = stanza.getChild('query');
  var vCard = stanza.getChild('vCard');
  if (query && query.attrs.xmlns == 'jabber:iq:roster') {
    var items = query.getChildren('item');
    //Collect names in associative array
    for (var i = 0; i < items.length; i++) {
      var attrs = items[i].attrs;
      if (attrs.jid && attrs.name) {
        this.setAttr(attrs.jid, 'name', attrs.name);
      }
    }
  }
  if (vCard && vCard.attrs.xmlns == 'vcard-temp') {
    var vcard = {};
    var fn = vCard.getChildText('FN');
    var url = vCard.getChildText('URL');
    var photo = vCard.getChild('PHOTO');
    if (fn) {
      vcard['name'] = fn;
      this.setAttr(from , 'name', fn);
    }
    if (url) {
      vcard['url'] = url;
      this.setAttr(from , 'url', url);
    }
    if (photo && photo.getChildText('EXTVAL')) {
      this.setAttr(from , 'imageUrl', photo.getChildText('EXTVAL'));
    } else if (photo && photo.getChildText('TYPE') &&
               photo.getChildText('BINVAL')) {
      var imageData = 'data:' +
          photo.getChildText('TYPE') + ';base64,' +
          photo.getChildText('BINVAL');
      var imageHash = this.getAttr(from, 'imageHash');
      vcard['imageData'] = imageData;
      vcard['imageHash'] = imageHash;
      this.setAttr(from, 'imageData', imageData);
    }
    storage.set('vcard-'+getBaseJid(from), JSON.stringify(vcard));
  }
};

// Fired when a contact is present.
IdentityProvider.prototype.onPresence = function(stanza) {
  // console.log(stanza.attrs.from);
  if(window.presence) {
    window.presence.push(stanza);
  } else {
    window.presence = [stanza];
  }
  //Set status
  var status = stanza.getChildText("show") || "online";
  if (stanza.attrs.type == 'unavailable') {
    status = stanza.attrs.type;
  }
  var hash = "unknown";
  try {
    hash = stanza.getChild("x").getChildText("photo");
  } catch(e) {
  }
  if (status == 'unavailable') {
    this.setDeviceAttr(stanza.attrs.from, 'status', 'offline');
  } else { //must be online or messageable
    //Set Uproxy capability
    var cap = stanza.getChild('c');
    //TODO check application version mismatch
    if (cap && cap.attrs.node==this.loginOpts.url) { //&& cap.attrs.ver==this.loginOpts.version) {
      this.setDeviceAttr(stanza.attrs.from, 'status', 'messageable');
    } else {
      this.setDeviceAttr(stanza.attrs.from, 'status', 'online');
    }
  }
  this.setDeviceAttr(stanza.attrs.from, 'xmppStatus', status);
  this.setAttr(stanza.attrs.from, 'imageHash', hash);
  //Update VCard
  this.getVCard(stanza.attrs.from, hash);
};

IdentityProvider.prototype.getVCard = function(from, hash) {
  storage.get('vcard-'+getBaseJid(from)).done((function(result) {
    //Fetch vcard from server if not cached
    if (result === null || result === undefined) {
      this.fetchVCard(from);
    } else {
      var resultObj = JSON.parse(result);
      if (hash == 'unknown' || hash == resultObj['imageHash']) {
        // console.log("Cached VCard: " + result);
        if (resultObj['name'] && this.getAttr(from, 'name') !== resultObj['name']) {
          this.setAttr(from, 'name', resultObj['name']);
        }
        if (resultObj['url'] && this.getAttr(from, 'url') !== resultObj['url']) {
          this.setAttr(from, 'url', resultObj['url']);
        }
        if (resultObj['imageData'] && this.getAttr(from, 'imageData') !== resultObj['imageData']) {
          this.setAttr(from, 'imageData', resultObj['imageData']);
        }
      } else {
        this.fetchVCard(from);
      }
    }
  }).bind(this));
};

IdentityProvider.prototype.fetchVCard = function(from) {
  var time = new Date();
  var baseJid = getBaseJid(from);
  if (!this.vCardRequestTime[baseJid] || (time - this.vCardRequestTime[baseJid]) > VCARD_REQUEST_TIMEOUT) {
    this.vCardRequestTime[baseJid] = time;
    this.vCardRequestQueue.push(baseJid);
    this.checkVCardQueue();
  }
};

IdentityProvider.prototype.checkVCardQueue = function() {
  var time = new Date();
  if (this.vCardRequestQueue.length < 1) {
    return;
  } else if ((time - this.vCardFetchTime) > VCARD_THROTTLE_TIMEOUT) {
    var from = this.vCardRequestQueue.shift();
    console.log("Fetching VCard for " + from);
    this.vCardFetchTime = time;
    this.client.send(new window.XMPP.Element('iq', {
      type: 'get',
      to: from
    }).c('vCard', {'xmlns': 'vcard-temp'}).up());
  } else {
    setTimeout(this.checkVCardQueue.bind(this), VCARD_THROTTLE_TIMEOUT);
  }
};

IdentityProvider.prototype.onMessage = function(stanza) {
  //console.log("incoming message from " + from + ": " + msg);
  if (stanza.is('message') && stanza.getChildText('body') && stanza.attrs.type !== 'error') {
    //TODO(ryscheng): extract data, send cleaned up stream structure?
    this.setDeviceAttr(stanza.attrs.from, 'lastSeen', new Date());
    //TODO check intended recipient
    if (stanza.attrs.to.indexOf(this.loginOpts.agent) >= 0) {
      this.dispatchEvent('onMessage', {
        fromUserId: getBaseJid(stanza.attrs.from),
        fromClientId: stanza.attrs.from,
        toUserId: getBaseJid(stanza.attrs.to),
        toClientId: stanza.attrs.to,
        message: stanza.getChildText('body')
        //message: JSON.parse(stanza.getChildText('body'))
      });
    } else {
      // This wasn't intended for me
      console.error('Unprocessed message: '+ JSON.stringify(stanza.attrs));
    }
  } else if (stanza.is('iq') && stanza.attrs.type == 'get') {
    // Respond to capability requests from other users.
    var query = stanza.getChild("query");
    if (query && query.attrs.xmlns == "http://jabber.org/protocol/disco#info") {
      this.setDeviceAttr(stanza.attrs.from, 'lastSeen', new Date());
      stanza.attrs.to = stanza.attrs.from;
      delete stanza.attrs.from;
      stanza.attrs.type = 'result';
      query.c('identity', {category: 'client', name: this.loginOpts.agent, type: 'bot'}).up()
        .c('feature', {'var': 'http://jabber.org/protocol/caps'}).up()
        .c('feature', {'var': 'http://jabber.org/protocol/disco#info'}).up()
        .c('feature', {'var': this.loginOpts.url}).up();
      this.client.send(stanza);
    }
  } else if (stanza.is('iq') && stanza.attrs.type == 'result') {
    this.onRoster(stanza);
  } else if (stanza.is('presence')) {
    this.onPresence(stanza);
  } else {    //Unhandled message
    if (window.droppedMessages) {
      window.droppedMessages.push(stanza);
    } else {
      window.droppedMessages = [stanza];
    }
  }
};

var identity = freedom.identity();
identity.provideAsynchronous(IdentityProvider);
