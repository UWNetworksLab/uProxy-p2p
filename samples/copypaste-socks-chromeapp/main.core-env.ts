/// <reference path='../../../../third_party/polymer/polymer.d.ts' />
/// <reference path='../../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../../third_party/freedom-typings/pgp.d.ts' />
/// <reference path='../../../../third_party/freedom-typings/freedom-common.d.ts' />
/// <reference path='../../../../third_party/freedom-typings/freedom-core-env.d.ts' />

import arraybuffers = require('../../arraybuffers/arraybuffers');
import signals = require('../../webrtc/signals');
import freedom_types = require('freedom.types');
import net = require('../../net/net.types');
import copypaste_api = require('./copypaste-api');

module copypaste_module {

  export var onceReady :Promise<freedom_types.OnAndEmit<any,any>> =
      freedom('freedom-module.json', {
          'logger': 'uproxy-lib/loggingprovider/freedom-module.json',
          'debug': 'debug'
      }).then((copypasteSocksFactory:() => freedom_types.OnAndEmit<any,any>) => {
    var copypaste :freedom_types.OnAndEmit<any,any> = copypasteSocksFactory();

    copypaste.on('signalForPeer', (message:signals.Message) => {
      model.readyForStep2 = true;

      // Base64-encode the signalling message because some communication
      // channels are likely to transform portions of the raw concatenated JSON
      // into emoticons, whereas the base64 alphabet is much less prone to such
      // unintended transformation.
      var messageAsJson = JSON.stringify(message);
      if (model.usingCrypto) {
        copypaste.emit('friendKey', model.friendPublicKey);
        copypaste.emit('signEncrypt', base64Encode(messageAsJson));
      }
      model.outboundMessageValue = base64Encode(messageAsJson);
    });

    copypaste.on('gotPeerSDP', (peerSDP:string) => {
      console.log('gotPeerSDP of length ' + peerSDP.length);
      parseInboundMessages(peerSDP);
      consumeInboundMessage();
    });

    copypaste.on('gatherMessage', () => {
      console.log('gatherMessage invoked.');
      console.log('gatherMessage: sending back:' + model.outboundMessageValue);

      copypaste.emit('getSendBack',
                     arraybuffers.stringToArrayBuffer(model.outboundMessageValue));
    });

    copypaste.on('giveWithSDP', (sdp:string) => {
      parseInboundMessages(sdp);
      consumeInboundMessage();
      setTimeout(() => {
        console.log("Emitting giveSendback with SDP: " + model.outboundMessageValue);
        copypaste.emit('giveSendBack',
                       arraybuffers.stringToArrayBuffer(model.outboundMessageValue));
      }, 500);
    });

    copypaste.on('publicKeyExport', (publicKey:string) => {
      model.userPublicKey = publicKey;
    });

    copypaste.on('ciphertext', (ciphertext:string) => {
      model.outboundMessageValue = ciphertext;
    });

    copypaste.on('verifyDecryptResult', (result:VerifyDecryptResult) => {
      model.inputDecrypted = true;
      model.inputSigned = result.signedBy[0] == model.friendUserId;
      model.inboundText = arraybuffers.arrayBufferToString(result.data);
      parseInboundMessages(model.inboundText);
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
  }, (e:Error) : any => {
    // Explicitly declare return type any to workaround this bug:
    //   https://github.com/Microsoft/TypeScript/issues/2010
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

  // Stores the parsed message for use later, if & when the user clicks the
  // button for consuming the messages.
  var parsedInboundMessage: Object;

  // Define basee64 helper functions that are type-annotated and meaningfully
  // named.
  function base64Encode(unencoded:string): string {
    return window.btoa(unencoded);
  }

  // Throws an exception if the input is malformed.
  function base64Decode(encoded:string): string {
    return window.atob(encoded);
  }

  // Parses the contents of the form field 'inboundMessageField' as a sequence of
  // signalling messages. Enables/disables the corresponding form button, as
  // appropriate. Returns null if the field contents are malformed.
  export function parseInboundMessages(inboundMessageFieldValue:string) : void {
    try {
      // Decode and de-serialise the pasted text.
      var messageJson = base64Decode(inboundMessageFieldValue.trim());
      parsedInboundMessage = JSON.parse(messageJson);

      // Enable the button for consuming the messages.
      model.inputIsWellFormed = true;
    } catch (e) {
      console.warn('cannot parse message: ' + e.message);
    }
  }

  // Forwards each line from the paste box to the Freedom app, which
  // interprets each as a signalling channel message. The Freedom app
  // knows whether this message should be sent to the socks-to-rtc
  // or rtc-to-net module. Disables the form field.
  export function consumeInboundMessage() : void {
    // Forward the signalling messages to the Freedom app.
    onceReady.then(function(copypaste) {
      copypaste.emit('handleSignalMessage', parsedInboundMessage);
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
