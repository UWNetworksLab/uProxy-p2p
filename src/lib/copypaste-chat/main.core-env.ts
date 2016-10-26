var startButton = document.getElementById('startButton');
var copyTextarea = <HTMLInputElement>document.getElementById('copy');
var pasteTextarea = <HTMLInputElement>document.getElementById('paste');
var receiveButton = document.getElementById('receiveButton');
var sendButton = document.getElementById('sendButton');
var sendArea = <HTMLInputElement>document.getElementById('sendArea');
var receiveArea = <HTMLInputElement>document.getElementById('receiveArea');

// Platform-specific function to load the freedomjs module (glue.js).
declare var loadModule:() => Promise<freedom.OnAndEmit<any, any>>;

loadModule().then((chat:freedom.OnAndEmit<any,any>) => {
  startButton.onclick = () => {
    chat.emit('start', {});
  };

  sendButton.onclick = () => {
    chat.emit('send', sendArea.value);
  };

  // Dispatches each line from the paste box as a signalling channel message.
  receiveButton.onclick = () => {
    var signals = pasteTextarea.value.split('\n');
    signals.forEach((signal:string) => {
      chat.emit('handleSignalMessage', signal);
    });
    pasteTextarea.disabled = true;
  };

  chat.on('signalForPeer', (signal:string) => {
    copyTextarea.value = copyTextarea.value.trim() + '\n' + signal;
  });

  chat.on('ready', () => {
    sendArea.disabled = false;
  });

  chat.on('receive', (message:string) => {
    receiveArea.value = message;
  });

  chat.on('error', () => {
    sendArea.disabled = true;
  });
}, (e:Error) => {
  console.error('could not load freedom module: ' + e.message);
});
