var CHROME_APP_ID = 'hilnpmepiebcjhibkbkfkjkacnnclkmi';

function AuthManager(opts) {
  this.opts = opts;
  this.status = null;
  this.credentials = null;
  this.port = null;
  this.connectToApp();
  this.updateStatus('offline', '');
};

AuthManager.prototype.connectToApp = function() {
  if (this.port) {
    console.log("AuthManager - Already connected to Chrome App");
    return;
  }
  this.port = chrome.runtime.connect(CHROME_APP_ID, {name: this.opts.name});
  this.port.onDisconnect.addListener(this.onDisconnect.bind(this));
  this.port.onMessage.addListener(this.onMessage.bind(this));
  
};

AuthManager.prototype.onDisconnect = function() {
  console.log('AuthManager - Chrome port disconnected');
  this.port = null;
};

AuthManager.prototype.onMessage = function(msg) {
  console.log("!!!" + msg);
};

AuthManager.prototype.updateStatus = function(status, message) {
  this.status = status;
  var div = document.getElementById('contents');
  if (this.status == 'offline') {
    while (div.firstChild) {
      div.removeChild(div.firstChild);
    }
    var img = document.createElement('img');
    img.src = this.opts.signinImg;
    img.width = this.opts.signinImgWidth;
    img.onclick = this.login.bind(this);
    div.appendChild(img);
    div.appendChild(document.createElement('br'));
  } else if (this.status == 'online') {
    while (div.firstChild) {
      div.removeChild(div.firstChild);
    }
    var img = document.createElement('img');
    img.src = this.opts.iconImg;
    img.width = this.opts.iconImgWidth;
    img.onclick = this.logout.bind(this);
    div.appendChild(img);
    div.appendChild(document.createElement('br'));
    if (message) {
      div.appendChild(document.createTextNode(message));
      div.appendChild(document.createElement('br'));
    }
    var logout = document.createElement('button');
    logout.onclick = this.logout.bind(this);
    logout.appendChild(document.createTextNode('Logout'));
    div.appendChild(logout);
  } else if (this.status == 'error') {
    div.appendChild(document.createTextNode('Error: '+message));
    div.appendChild(document.createElement('br'));
  } else {
    console.error('AuthManager - Unrecognized status');
  }
};

