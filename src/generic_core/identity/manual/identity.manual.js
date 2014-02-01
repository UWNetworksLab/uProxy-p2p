var window = {};
var view = freedom['core.view']();

function IdentityProvider() {
  console.log("Manual Identity Provider");
  this.status = 'offline';
  this.userId = 'manual';
  this.profile = {
    me: {
      'manual': {
        userId: 'manual',
        clients: {
          manual: {
            clientId: 'manual',
            network: 'manual',
            status: 'messageable'
          }
        }
      }
    },
    roster: {}
  };

  setTimeout((function() {
    this.dispatchEvent('onStatus', {
      userId: this.userId,
      network: 'manual',
      status: this.status,
      message: "Woo!"
    });
  }).bind(this), 0);

  view.open({
    file: "manual"
  });
  view.on('message', (function(data) {
    if (data.cmd && data.cmd == 'manual-msg' && data.message) {
      this.dispatchEvent('onMessage', {
        network: 'manual',
        message: JSON.parse(data.message)
      });
    }
  }).bind(this));
}

IdentityProvider.prototype.login = function(opts, continuation) {
  //this.dispatchEvent('onChange', this.profile.me);
  this.status = 'online';
  this.dispatchEvent('onStatus', {
    userId: this.userId,
    network: 'manual',
    status: this.status,
    message: 'Woo!'
  });
  continuation();
};

IdentityProvider.prototype.getProfile = function(id, continuation) {
  if (id == undefined) {
    continuation(this.profile);
  } else if (this.profile.me[id]) {
    continuation(this.profile);
  } else if (this.profile.roster[id]) {
    continuation({me: this.profile.roster[id], roster: {}});
  }
};

IdentityProvider.prototype.sendMessage = function(to, msg, continuation) {
/**
  'onMessage': {type: "event", value: {
    "fromUserId": "string",   //userId of user message is from
    "fromClientId": "string", //clientId of user message is from
    "toUserId": "string",     //userId of user message is to
    "toClientId": "string",   //clientId of user message is to
    "message": "object"       //message contents
**/
  if (to && msg && to !== '' && msg !== '') {
    view.postMessage({
      cmd: 'manual-send',
      to: to,
      msg: JSON.stringify(msg)
    });
  } else {
    view.postMessage({
      cmd: 'manual-recv'
    });
  }
};

IdentityProvider.prototype.logout = function(userId, networkName, continuation) {
  this.status = 'offline'; 
  this.dispatchEvent('onStatus', {
    userId: this.userId,
    network: 'manual',
    status: this.status,
    message: 'Woo!'
  });
  continuation({
    userId: this.userId,
    success: true,
    message: 'Null logout process'
  });
};

var identity = freedom.identity();
identity.provideAsynchronous(IdentityProvider);
