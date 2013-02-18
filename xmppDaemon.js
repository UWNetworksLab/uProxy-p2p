(function(exports) {
  function Roster(daemon) {
    this.daemon = daemon;
    this.jids = {};
    this.listener = function() {};
    this.friends = [];
  }
  
  Roster.prototype.seen = function(jid) {
    if (this.jids[jid]) {
      this.jids[jid].lastSeen = new Date();
    } else {
      this.jids[jid] = {lastSeen: new Date()};
    }
    if (this.getFriends() != this.friends) {
      this.friends = this.getFriends();
      this.listener(this.friends);
    }
  }
  
  Roster.prototype.drop = function(jid) {
    if (this.jids[jid]) {
      delete this.jids[jid];
    }
    if (this.getFriends() != this.friends) {
      this.friends = this.getFriends();
      this.listener(this.friends);
    }
  }
  
  Roster.prototype.getFriends = function() {
    var friends = [];
    for (var i in this.jids) {
      if (!this.jids.hasOwnProperty(i)) {
        continue;
      }
      if (i.indexOf("/uproxy") > 0 && i != this.daemon.client.jid.toString()) {
        friends.push(i);
      }
    }
    return friends;
  }
  
  Roster.prototype.setListener = function(l) {
    this.listener = l;
  }

  function XmppDaemon(credentials) {
    this.roster = new Roster(this);
    this.client = new XMPP.Client({
      xmlns:'jabber:client',
      jid: credentials.email + "/uproxy",
      oauth2_token: credentials.token,
      oauth2_auth: 'http://www.google.com/talk/protocol/auth',
      host: "talk.google.com"
    });
    this.messageListener = function() {};

    //TODO(willscott): Support Upgrade to TLS wrapped connection.  
    this.client.connection.allowTLS = false;

    this.addListeners();
  }
  
  XmppDaemon.prototype.addListeners = function() {
    this.client.addListener('online', this.onOnline.bind(this))
    this.client.addListener('error', function(e) {
      console.error(e);
    });
    this.client.addListener('stanza', this.onMessage.bind(this));
  }
  
  XmppDaemon.prototype.onOnline = function() {
    this.client.send(new XMPP.Element('presence', {})
        .c("show").t("xa").up() //mark status of this client as 'extended away'.
        .c('priority').t("-127").up() // mark priority as low.
        .c("c", { // Advertise extended capabilities.
          xmlns: "http://jabber.org/protocol/caps",
          node: "https://github.com/UWNetworksLab/UProxy",
          ver: "uproxy-caps-1.0",
          hash: "fixed"
        })
      );
  }
  
  XmppDaemon.prototype.onMessage = function(stanza) {
    if (stanza.is('message') && stanza.attrs.type !== 'error') {
      //TODO(willscott): extract data, send cleaned up stream structure?
      this.messageListener(JSON.parse(stanza.getChildText("body")));
    } else if (stanza.is('iq') && stanza.attrs.type == 'get') {
      var query = stanza.getChild("query");
      // Respond to capability requests from other users.
      if (query && query.attrs.xmlns == "http://jabber.org/protocol/disco#info") {
        this.roster.seen(stanza.attrs.from);
        stanza.attrs.to = stanza.attrs.from;
        delete stanza.attrs.from;
        stanza.attrs.type = 'result';
        query.c('identity', {
          category: 'client',
          name: 'Uproxy',
          type: 'bot'
        }).up()
        .c('feature', {'var': 'http://jabber.org/protocol/caps'}).up()
        .c('feature', {'var': 'http://jabber.org/protocol/disco#info'}).up()
//        .c('feature', {'var': ''}).up()
        this.client.send(stanza);
      }
    } else if (stanza.is('presence')) {
      if (stanza.attrs.type == 'unavailable') {
        this.roster.drop(stanza.attrs.from);
      } else {
        this.roster.seen(stanza.attrs.from);
      }
    }
  }
  
  XmppDaemon.prototype.setStreamListener = function(listener) {
    this.messageListener = listener;
  }
  
  XmppDaemon.prototype.setRosterListener = function(listener) {
    this.roster.setListener(listener);
  }
  
  XmppDaemon.prototype.sendMessage = function(to, msg) {
    this.client.send(new XMPP.Element('message', {
      to: to,
      type: 'chat'
    }).c('body').t(JSON.stringify(msg)));
  }
  
  exports.XmppDaemon = XmppDaemon;
})(window);
