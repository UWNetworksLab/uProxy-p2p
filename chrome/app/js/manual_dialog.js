function ManualDialog(cb) {
  this.messageCallback = cb;
  this.manualdialog = null;
  this.manualport = null;
  this.manualMsgQueue = [];
  chrome.runtime.onConnect.addListener(this.onConnect.bind(this));
};

ManualDialog.prototype.createManualWindow = function() {
  chrome.app.window.create(
    //'submodules/uproxy-common/identity/manual/manualdialog.html',
    'dialogs/manualidentity/manualdialog.html',
    {
      id: 'manual',
      minWidth: 600,
      minHeight: 400,
      maxWidth: 600,
      maxHeight: 400
    },
    (function(child_win) {
      this.manualdialog = child_win;
      this.manualdialog.onClosed.addListener((function() {
        if (this.manualport) {
          this.manualport.disconnect();
          this.manualport = null;
        }
        this.manualdialog = null;
      }).bind(this));
    }).bind(this)
  ); 
};

ManualDialog.prototype.onConnect = function(port) {
  if (port.name !== 'manualdialog') {
    console.error("Unexpected internal port connection from " + port.sender.id);
    return;
  } 
  
  this.manualport = port;
  this.manualport.onMessage.addListener(this.onMessage.bind(this));
  this.manualport.onDisconnect.addListener((function() {
    this.manualport = null;
  }).bind(this));
  for (var i=0; i < this.manualMsgQueue.length; i++) {
    this.manualport.postMessage(this.manualMsgQueue[i]);
  }
  this.manualMsgQueue = [];
};

ManualDialog.prototype.sendMessage = function(msg) {
  this.createManualWindow();
  if (this.manualport) {
    this.manualport.postMessage(msg);
  } else {
    this.manualMsgQueue.push(msg);
  }
};

ManualDialog.prototype.onMessage = function(msg) {
  this.messageCallback(msg);
};

