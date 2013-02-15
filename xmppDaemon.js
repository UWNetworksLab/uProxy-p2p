(function(exports) {
  
  function XmppDaemon(credentials) {
    this.roster = [];
    this.client = new XMPP.Client({
      xmlns:'jabber:client',
      jid: credentials.email + "/uproxy",
      oauth2_token: credentials.token,
      oauth2_auth: 'http://www.google.com/talk/protocol/auth',
      host: "talk.google.com"
    });
    this.messageListener = function() {};
    this.rosterListener = function() {};

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
    //TODO(willscott): Subscribe to roster changes.
    this.client.send(new XMPP.Element('iq', {type: 'get'})
        .c("query", {xmlns: "jabber:iq:roster"}));
    this.client.send(new XMPP.Element('presence', {})
        .c("show").t("xa").up() //mark status of this client as 'extended away'.
        .c('priority').t("-128").up() // mark priority as low.
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
      this.messageListener(stanza);
    } else if (stanza.is('iq') && stanza.attrs.type == 'get') {
      var query = stanza.getChild("query");
      // Respond to capability requests from other users.
      if (query && query.attrs.xmlns == "http://jabber.org/protocol/disco#info") {
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
    } else if (stanza.is('iq') && stanza.attrs.type == 'result') {
      var query = stanza.getChild("query");
      // Handle roster updates.
      if (query && query.attrs.xmlns == "jabber:iq:roster") {
        for (var i = 0; i < query.children.length; i++) {
          this.roster.push(query.children[i].attrs.jid);
        }
        this.rosterListener(this.roster);
      }
    }
  }
  
  XmppDaemon.prototype.setStreamListener = function(listener) {
    this.messageListener = listener;
  }
  
  XmppDaemon.prototype.setRosterListener = function(listener) {
    this.rosterListener = listener;
  }
  
  XmppDaemon.prototype.sendMessage = function(to, msg) {
    
  }
  
  
  exports.XmppDaemon = XmppDaemon;
})(window);
