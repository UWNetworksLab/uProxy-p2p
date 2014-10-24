/// <reference path='messages.d.ts' />
/// <reference path='../../logging/logging.d.ts' />

// TODO: update src/freedom/typings/freedom.d.ts
declare var freedom:any;

var log :Logging.Log = new Logging.Log('main');

var sendButtonA = document.getElementById("sendButtonA");
var sendButtonB = document.getElementById("sendButtonB");

var sendAreaA = <HTMLInputElement>document.getElementById("sendAreaA");
var sendAreaB = <HTMLInputElement>document.getElementById("sendAreaB");
var receiveAreaA = <HTMLInputElement>document.getElementById("receiveAreaA");
var receiveAreaB = <HTMLInputElement>document.getElementById("receiveAreaB");

freedom('freedom-module.json', { 'debug': 'log' }).then(function(interface:any) {
  // TODO: typings for the freedom module
  var chat :any = interface();

  chat.on('ready', function() {
    log.info('peer connection established!');
    sendAreaA.disabled = false;
    sendAreaB.disabled = false;
  });

  chat.on('error', function() {
    log.error('something went wrong with the peer connection');
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

  function receive(textArea:HTMLInputElement, msg:Chat.Message) {
    textArea.value = msg.message;
  }
  chat.on('receiveA', receive.bind(null, receiveAreaA));
  chat.on('receiveB', receive.bind(null, receiveAreaB));
}, (e:Error) => {
  log.error('could not load freedom: ' + e.message);
});
