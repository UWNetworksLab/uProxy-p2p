var identity = freedom.identity();

var onload = function() {
  //Fetch UID
  var namepromise = identity.get();
  namepromise.done(function(data) {
    freedom.emit('id', data.id);
  });

  freedom.on("forward", function(msg) {
    console.log("forward:"+msg);
    freedom.emit("backward", "testmessage");
  });
}

//TODO(willscott): WebWorkers startup errors are hard to debug.
// Once fixed, the setTimeout will no longer be needed.
setTimeout(onload, 0);
