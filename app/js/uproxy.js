var identity = freedom.identity();
var storage = freedom.storage();
var state = {
  id: "Foobar",
  my_card: {}
  status_msg: "I'm good",
  allowed_peers: ['alice@gmail.com'],
  blocked_peers: ['bob@gmail.com'],
  roster: {},
  msg_log: []
};

var onload = function() {
  //Restore state from storage
  storage.get("state").done(function (data) {
    if (data !== null) {
      state = data;
    }
  });
  
  //Fetch UID
  //state.id = identity.id;
  identity.getProfile(null).done(function(data) {
    state.id = data.card.id;
    state.my_card = data.card;
    state.roster = data.roster;
  });

  //TODO check status
  state.status_msg = "Your connection is currently not being proxied";

  //Everytime pop-up is opened
  freedom.on('open-popup', function(msg) {
    freedom.emit('state-change',[{
      'op': 'replace',
      'path': '',
      'value': state
    }]);
  });

  freedom.on('oauth-credentials', function(msg) {
    console.log(JSON.stringify(msg));
  });

  identity.on('onChange', function(data) {
    //If my card changed
    if (data.id && data.id == state.id) {
      state.my_card = data;
      freedom.emit('state-change', [{
        'op': 'replace',
        'path': '/my_card',
        'value': data
      }]);
    } else { //must be a buddy
      state.roster[data.id] = data;
      freedom.emit('state-change', [{
        'op': 'replace',
        'path': '/roster/'+data.id,
        'value': data
      }]);
    }
  });

  identity.on('onMessage', function(data) {
    state.msg_log.push(data);
    freedom.emit("state-change", [{
      'op': 'add',
      'path': '/msg_log/-',
      'value': data
    }]);
  });

  freedom.on("send-message", function(data) {
    identity.sendMessage(data.to, data.message);
  });
}

//TODO(willscott): WebWorkers startup errors are hard to debug.
// Once fixed, the setTimeout will no longer be needed.
setTimeout(onload, 0);

