/// <reference path='../../../../third_party/freedom-typings/freedom-core-env.d.ts' />

var sendButtonA = document.getElementById("sendButtonA");
var sendButtonB = document.getElementById("sendButtonB");

var sendAreaA = <HTMLInputElement>document.getElementById("sendAreaA");
var sendAreaB = <HTMLInputElement>document.getElementById("sendAreaB");
var receiveAreaA = <HTMLInputElement>document.getElementById("receiveAreaA");
var receiveAreaB = <HTMLInputElement>document.getElementById("receiveAreaB");

var stopButton = document.getElementById("stopButton");

freedom('freedom-module.json', {
    'logger': 'uproxy-lib/loggingprovider/freedom-module.json',
    'debug': 'debug'
  }).then((chatFactory:() => freedom.OnAndEmit<any,any>) => {
  var chat :freedom.OnAndEmit<any,any> = chatFactory();

  chat.on('ready', function() {
    sendAreaA.disabled = false;
    sendAreaB.disabled = false;
  });

  chat.on('error', function() {
    sendAreaA.disabled = true;
    sendAreaB.disabled = true;
  });

  function send(suffix:string, textArea:HTMLInputElement) {
    chat.emit('send' + suffix, textArea.value || '(empty message)');
  }
  sendButtonA.onclick = send.bind(null, 'A', sendAreaA);
  sendButtonB.onclick = send.bind(null, 'B', sendAreaB);

  function receive(textArea:HTMLInputElement, msg:string) {
    textArea.value = msg;
  }
  chat.on('receiveA', receive.bind(null, receiveAreaA));
  chat.on('receiveB', receive.bind(null, receiveAreaB));

  stopButton.onclick = () => {
    chat.emit('stop');
  };
}, (e:Error) => {
  console.error('could not load freedom module: ' + e.message);
});
