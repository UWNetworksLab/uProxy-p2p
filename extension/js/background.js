var buddies = [];
var msg_listeners = [];
var id;

//freedom.on('buddylist-update', function (msg) {
//  buddies = msg;
//});

freedom.on('id', function(msg) {
  id = msg;
});

freedom.on('message-update', function (msg) {
  console.log('new message: '+msg);
  for (var i = 0; i < msg_listeners.length; i++) {
    msg_listeners[i](msg);
  }
});

function sendMsg(to, msg) {
  freedom.emit('send-message', msg);
}

function addMsgListener(func) {
  msg_listeners.push(func);
}

freedom.emit('start-extension', 'start');
