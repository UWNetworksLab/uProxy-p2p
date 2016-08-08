/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../../../../third_party/typings/index.d.ts' />

import arraybuffers = require('../arraybuffers/arraybuffers');
import signals = require('../webrtc/signals');
import net = require('../net/net.types');
import copypaste_api = require('../copypaste-socks/copypaste-api');

// Platform-specific function to load the freedomjs module.
declare var loadModule: () => Promise<freedom.OnAndEmit<any, any>>;

module copypaste_module {

  export var onceReady :Promise<freedom.OnAndEmit<any,any>> =
      loadModule().then((copypaste:freedom.OnAndEmit<any,any>) => {
    copypaste.on('signalForPeer', (message:string) => {
      model.readyForStep2 = true;
      if (model.usingCrypto) {
        copypaste.emit('friendKey', model.friendPublicKey);
        copypaste.emit('signEncrypt', message);
      }
      model.outboundMessageValue = message;
    });

    copypaste.on('publicKeyExport', (publicKey:string) => {
      model.userPublicKey = publicKey;
    });

    copypaste.on('ciphertext', (ciphertext:string) => {
      model.outboundMessageValue = ciphertext;
    });

    copypaste.on('signalMessageResult', (result:boolean) => {
      model.inputIsWellFormed = result;
    });

    copypaste.on('verifyDecryptResult', (result:freedom.PgpProvider.VerifyDecryptResult) => {
      model.inputDecrypted = true;
      model.inputSigned = result.signedBy[0] == model.friendUserId;
      model.inboundText = arraybuffers.arrayBufferToString(result.data);
    });

    copypaste.on('bytesReceived', (numNewBytesReceived:number) => {
      model.totalBytesReceived += numNewBytesReceived;
    });

    copypaste.on('bytesSent', (numNewBytesSent:number) => {
      model.totalBytesSent += numNewBytesSent;
    });

    copypaste.on('proxyingStarted', (listeningEndpoint:net.Endpoint) => {
      if (listeningEndpoint !== null) {
        model.endpoint = listeningEndpoint.address + ':' + listeningEndpoint.port;
      }
      model.proxyingState = 'started';
    });

    copypaste.on('proxyingStopped', () => {
      model.proxyingState = 'stopped';
    });
    return copypaste;
  }, (e:Error) => {
    console.error('could not load freedom: ' + e.message);
  });

  // TODO: use actual interaction to define user-ids.
  export var model :copypaste_api.Model = {
    givingOrGetting : <string>null,
    usingCrypto : false,
    inputDecrypted : false,
    inputSigned : false,
    userPublicKey : '',
    friendPublicKey : '',
    friendUserId : 'Joe <joe@test.com>',
    readyForStep2 : false,
    outboundMessageValue : '',
    inboundText: '',
    inputIsWellFormed : false,
    proxyingState : 'notYetAttempted',
    endpoint : <string>null,  // E.g., '127.0.0.1:9999'
    totalBytesReceived : 0,
    totalBytesSent : 0
  };

  // Sends the contents of the paste box to the freedomjs module, which
  // validates and sends back the results via a ''
  export function parseInboundMessages() : void {
    onceReady.then(function(copypaste) {
      copypaste.emit('validateSignalMessage', model.inboundText.trim());
    });
  }

  // Forwards each line from the paste box to the Freedom app, which
  // interprets each as a signalling channel message. The Freedom app
  // knows whether this message should be sent to the socks-to-rtc
  // or rtc-to-net module. Disables the form field.
  export function consumeInboundMessage() : void {
    // Forward the signalling messages to the Freedom app.
    onceReady.then(function(copypaste) {
      copypaste.emit('handleSignalMessage', model.inboundText.trim());
    });
    model.proxyingState = 'connecting';
    // TODO: Report success/failure to the user.
  };

  export function verifyDecryptInboundMessage(ciphertext:string) : void {
    onceReady.then(function(copypaste) {
      copypaste.emit('friendKey', model.friendPublicKey);
      copypaste.emit('verifyDecrypt', ciphertext);
    });
  };

}  // module copypaste_api

export var copypaste :copypaste_api.CopypasteApi = copypaste_module;
