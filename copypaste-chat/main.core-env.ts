/// <reference path='../../../third_party/typings/freedom/freedom-core-env.d.ts' />

import churn_types = require('../churn/churn.types');
import ChurnSignallingMessage = churn_types.ChurnSignallingMessage;

export interface OnEmitModule extends freedom.OnAndEmit<any,any> {};
export interface OnEmitModuleFactory extends
  freedom.FreedomModuleFactoryManager<OnEmitModule> {};

var startButton = document.getElementById("startButton");
var copyTextarea = <HTMLInputElement>document.getElementById("copy");
var pasteTextarea = <HTMLInputElement>document.getElementById("paste");
var receiveButton = document.getElementById("receiveButton");
var sendButton = document.getElementById("sendButton");
var sendArea = <HTMLInputElement>document.getElementById("sendArea");
var receiveArea = <HTMLInputElement>document.getElementById("receiveArea");

// Platform-specific function to load the freedomjs module (glue.js).
declare var loadModule: () => Promise<freedom.OnAndEmit<any, any>>;

loadModule().then((copypasteChurnChat:freedom.OnAndEmit<any,any>) => {
  // Dispatches each line from the paste box as a signalling channel message.
  function handleSignallingMessages() {
    var signals = pasteTextarea.value.split('\n');
    for (var i = 0; i < signals.length; i++) {
      var s:string = signals[i];
      // Ignore blank lines.
      if (s) {
        var signal:ChurnSignallingMessage = JSON.parse(s);
        copypasteChurnChat.emit('handleSignalMessage', signal);
      }
    }

    // "Flush" the signalling channel input.
    pasteTextarea.value = '';
  }

  function start() {
    copypasteChurnChat.emit('start', {});
  }

  startButton.onclick = start;
  receiveButton.onclick = handleSignallingMessages;

  copypasteChurnChat.on('signalForPeer', (signal:ChurnSignallingMessage) => {
    copyTextarea.value = copyTextarea.value.trim() + '\n' + JSON.stringify(signal);
  });

  copypasteChurnChat.on('ready', function() {
    console.log('peer connection established!');
    // Hide remaining signalling channel contents.
    copyTextarea.value = '';
    sendArea.disabled = false;
  });

  copypasteChurnChat.on('error', function() {
    console.error('something went wrong with the peer connection');
    sendArea.disabled = true;
  });

  sendButton.onclick = function() {
    // Currently, PeerConnection does not support empty text messages:
    //   https://github.com/freedomjs/freedom/issues/67
    copypasteChurnChat.emit('send', sendArea.value || '(empty message)');
  }

  copypasteChurnChat.on('receive', function(message:string) {
    receiveArea.value = message;
  });
}, (e:Error) => {
  console.error('could not load freedom: ' + e.message);
});
