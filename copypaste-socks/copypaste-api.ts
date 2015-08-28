/// <reference path='../../../third_party/freedom-typings/freedom-common.d.ts' />

import freedom_types = require('freedom.types');

// 'model' object contains variables about the state of the application.
// Polymer elements will bind to model so that the elements' style and
// contents are up to date.
export interface Model {
  givingOrGetting : string;
  usingCrypto : boolean;
  inputDecrypted : boolean;
  inputSigned : boolean;
  userPublicKey : string;
  friendPublicKey : string;
  friendUserId : string; // e.g. 'Joe <joe@test.com>',
  readyForStep2 : boolean;
  outboundMessageValue : string;
  inboundText: string;
  proxyingState : string; // e.g. 'notYetAttempted',
  endpoint : string; // E.g., '127.0.0.1:9999'
  totalBytesReceived : number;
  totalBytesSent : number;
}

export interface CopypasteApi {
  // This is a promise for the freedom module stub.
  onceReady :Promise<freedom_types.OnAndEmit<any,any>>;
  model :Model;
  consumeInboundMessage :() => void;
  verifyDecryptInboundMessage :(ciphertext:string) => void;
}
