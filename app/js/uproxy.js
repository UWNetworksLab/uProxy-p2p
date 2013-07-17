var identity = freedom.identity();

var onload = function() {
  //Fetch UID
  var namepromise = identity.get();
  namepromise.done(function(data) {
    freedom.emit('id', data.id);
  });

  //Echo Service
  freedom.on("send-message", function(msg) {
    console.log("msg: "+msg);
    freedom.emit("message-update", msg);
  });
}

//TODO(willscott): WebWorkers startup errors are hard to debug.
// Once fixed, the setTimeout will no longer be needed.
setTimeout(onload, 0);
