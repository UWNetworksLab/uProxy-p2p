/// <reference path='../../../../third_party/typings/index.d.ts' />

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
  inputIsWellFormed : boolean;
  proxyingState : string; // e.g. 'notYetAttempted',
  endpoint : string; // E.g., '127.0.0.1:9999'
  totalBytesReceived : number;
  totalBytesSent : number;
}

export interface CopypasteApi {
  // This is a promise for the freedom module stub.
  onceReady :Promise<freedom.OnAndEmit<any,any>>;
  model :Model;
  parseInboundMessages :() => void;
  consumeInboundMessage :() => void;
  verifyDecryptInboundMessage :(ciphertext:string) => void;
}
