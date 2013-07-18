var popup_listeners = {};

//freedom.on('buddylist-update', function (msg) {
//  buddies = msg;
//});

freedom.on('id', function(msg) {
  if (popup_listeners['id']) {
    popup_listeners['id'](msg);
  } else {
    console.log('Handler missing for: id');
  }
});

freedom.on('message-update', function (msg) {
  console.log('new message: '+msg);
  if (popup_listeners['message-update']) {
    popup_listeners['message-update'](msg);
  } else {
    console.log('Handler missing for: message-update');
  }
});


freedom.emit('open-extension', '');
