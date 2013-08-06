var View_oauth = function(channel) {
  this.channel = channel;
};

View_oauth.prototype.open = function(args, continuation) {
  var file = args.file;
  if (file == "oauth.html") {
    if (!this.listening) {
      this.listening = true;
      freedom.on('oauth', this.dispatchEvent.bind(this,'message'));
    }
    continuation();
  } else {
    console.warn("Authentication view provider asked to served unknown path: " + file);
    continuation();
  }
}

View_oauth.prototype.show = function(continuation) {
  continuation();
}

View_oauth.prototype.postMessage = function(args, continuation) {
  continuation();
}

View_oauth.prototype.close = function() {
  this.callback = null;
}
