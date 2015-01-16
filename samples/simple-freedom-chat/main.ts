/// <reference path="../../freedom/typings/freedom.d.ts" />

import Message = require('./messages.i');

var sendButtonA = document.getElementById("sendButtonA");
var sendButtonB = document.getElementById("sendButtonB");

var sendAreaA = <HTMLInputElement>document.getElementById("sendAreaA");
var sendAreaB = <HTMLInputElement>document.getElementById("sendAreaB");
var receiveAreaA = <HTMLInputElement>document.getElementById("receiveAreaA");
var receiveAreaB = <HTMLInputElement>document.getElementById("receiveAreaB");

freedom('freedom-module.json', {
    'logger': 'lib/loggingprovider/loggingprovider.json',
    'debug': 'debug'
  }).then(
    (simpleChatFactory:() => OnAndEmit<any,any>) => {
  // TODO: typings for the freedom module
  var chat :OnAndEmit<any,any> = simpleChatFactory();

  chat.on('ready', function() {
    sendAreaA.disabled = false;
    sendAreaB.disabled = false;
  });

  chat.on('error', function() {
    sendAreaA.disabled = true;
    sendAreaB.disabled = true;
  });

  function send(suffix:string, textArea:HTMLInputElement) {
    chat.emit('send' + suffix, {
      message: textArea.value || '(empty message)'
    });
  }
  sendButtonA.onclick = send.bind(null, 'A', sendAreaA);
  sendButtonB.onclick = send.bind(null, 'B', sendAreaB);

  function receive(textArea:HTMLInputElement, msg:Message) {
    textArea.value = msg.message;
  }
  chat.on('receiveA', receive.bind(null, receiveAreaA));
  chat.on('receiveB', receive.bind(null, receiveAreaB));
}, (e:Error) => {
  console.error('could not load freedom: ' + e.message);
});
