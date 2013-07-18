var identity = freedom.identity();
var storage = freedom.storage();
var state = {
  id: "Foobar",
  status_msg: "",
  allowed_peers: [
    {'name': 'Alice', 'id': 'alice@gmail.com'},
    {'name': 'Bob', 'id': 'bob@gmail.com'}
  ],
  blocked_peers: [],
  online_peers: [],
  msg_log: []
};

var onload = function() {
  storage.get("allowed_peers").done(function (data) {
    if (data !== null) {
      state.allowed_peers = data;
    }
  });
  storage.get("blocked_peers").done(function (data) {
    if (data !== null) {
      state.blocked_peers = data;
    }
  });
  
  //Fetch UID
  identity.get().done(function(data) {
    state.id = data.id;
    freedom.emit('state-change', [{
      'op': 'replace',
      'path': '/id',
      'value': state.id
    }]);
  });

  //TODO check status
  state.status_msg = "Your connection is currently not being proxied";

  //Everytime pop-up is opened
  freedom.on('open-popup', function(msg) {
    var patch = [{
      'op': 'replace',
      'path': '',
      'value': state
    }];
    freedom.emit('state-change', patch);
  });

  freedom.on('oauth-credentials', function(msg) {
    console.log(JSON.stringify(msg));
  });

  identity.on('buddylist', function(list) {
    for (var i = 0; i < list.length; i++) {
      if (allowed_peers.indexOf(list[i]) >= 0) {
        
      } else if (blocked_peers.indexOf([i]) >= 0) {

      } else {

      }
    }
  });

  //Echo Service
  freedom.on("send-message", function(msg) {
    state.msg_log.push(msg);  
    var patch = [{
      'op': 'add',
      'path': '/msg_log/-',
      'value': msg
    }];
    console.log("msg: "+msg);
    freedom.emit("state-change", patch);
  });
}

//TODO(willscott): WebWorkers startup errors are hard to debug.
// Once fixed, the setTimeout will no longer be needed.
setTimeout(onload, 0);

